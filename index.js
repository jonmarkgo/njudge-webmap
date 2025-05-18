// server.js
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// --- Configuration ---
const MAP_DATA_FILE_PATH = '/home/judge/data/map.machiavelli'; // For the new API endpoint

const DIP_CLI_PATH = '/home/judge/dip';
const DIP_CLI_ARGS = ['-C', '/home/judge', '-w'];
const DIP_CLI_CWD = path.dirname(DIP_CLI_PATH);

const MAPIT_CLI_PATH = '/home/judge/flocscripts/mapit/mapit';
const MAPPS_ENV_VAR = '/home/judge/flocscripts/mapit/maps/Machiavelli.cmap.ps';
const MAPINFO_ENV_VAR = '/home/judge/flocscripts/mapit/maps/Machiavelli.info';

const DIP_FROM_EMAIL = "me@jonmarkgo.com";
const DIP_TO_EMAIL = "jonmarkgodiplomacyadjudicator@gmail.com";
const DIP_SUBJECT = "map";
// --- End Configuration ---

// Helper function to get cookie values
function getCookieValue(cookieHeader, name) {
    if (!cookieHeader) {
        // console.log(`[getCookieValue] Cookie header is null/empty for name: ${name}`);
        return null;
    }
    const cookies = cookieHeader.split(';');
    // console.log(`[getCookieValue] Searching for name: '${name}' in header: '${cookieHeader}'`);
    for (let c of cookies) {
        const originalC = c;
        const trimmedC = c.trim();
        const nameToSearch = name + '=';
        const startsWithResult = trimmedC.startsWith(nameToSearch);
        
        if (name === 'machHelperPlayerPower') { // Only log verbosely for the cookie we are debugging
            console.log(`[getCookieValue Debug for ${name}] Original part: '${originalC}', Trimmed part: '${trimmedC}', Searching for: '${nameToSearch}', StartsWith: ${startsWithResult}`);
        }

        if (startsWithResult) {
            const value = trimmedC.substring(nameToSearch.length);
            // console.log(`[getCookieValue] Found name: '${name}', raw value: '${value}'`);
            try {
                const decodedValue = decodeURIComponent(value);
                // console.log(`[getCookieValue] Decoded value: '${decodedValue}'`);
                return decodedValue;
            } catch (e) {
                console.error(`[getCookieValue] Error decoding URI component for value '${value}':`, e);
                return value; // Return raw value if decoding fails
            }
        }
    }
    // console.log(`[getCookieValue] Name '${name}' not found.`);
    return null;
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies
app.use(express.json());

// API endpoint to serve the map.machiavelli data
app.get('/api/map-file-data', (req, res) => {
    fs.readFile(MAP_DATA_FILE_PATH, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading map data file (${MAP_DATA_FILE_PATH}):`, err);
            return res.status(500).send('Error reading map data file.');
        }
        res.type('text/plain').send(data);
    });
});

app.get('/generate-map', (req, res) => {
    console.log('Received request to /generate-map');

    const cookieHeader = req.headers.cookie;
    const cookieGameName = getCookieValue(cookieHeader, 'machHelperGameName'); // Use top-level function
    const requestedGameName = req.query.gameName || cookieGameName;
    
    let dipCoreCommand = "list machtest12345"; // Default
    if (requestedGameName) {
        dipCoreCommand = `list ${requestedGameName}`;
        console.log(`Using gameName: ${requestedGameName}. DIP_CORE_COMMAND set to: "${dipCoreCommand}"`);
    } else {
        console.log(`No gameName. Using default DIP_CORE_COMMAND: "${dipCoreCommand}"`);
    }

    const now = new Date();
    const dateString = now.toUTCString();
    const dipStdinDynamicContent = `FROM: ${DIP_FROM_EMAIL}
TO: ${DIP_TO_EMAIL}
Subject: ${DIP_SUBJECT}
Date: ${dateString}

${dipCoreCommand}
SIGN OFF
`;

    console.log(`Spawning dip process: ${DIP_CLI_PATH} ${DIP_CLI_ARGS.join(' ')} with CWD: ${DIP_CLI_CWD}`);
    const dipProcess = spawn(DIP_CLI_PATH, DIP_CLI_ARGS, { cwd: DIP_CLI_CWD });

    let dipStdoutData = '';
    let dipStderrData = '';

    dipProcess.stdin.on('error', (err) => {
        console.error('ERROR on dipProcess.stdin:', err);
        if (!res.headersSent && !res.writableEnded) {
            res.status(500).json({ error: `Error writing to dip process stdin: ${err.message}` });
        }
    });

    dipProcess.stdout.on('data', (data) => {
        dipStdoutData += data.toString();
    });

    dipProcess.stderr.on('data', (data) => {
        const errChunk = data.toString();
        console.error(`dip stderr chunk: ${errChunk}`);
        dipStderrData += errChunk;
    });

    dipProcess.on('error', (spawnError) => {
        console.error('Failed to start dip process (spawn error):', spawnError);
        if (!res.headersSent && !res.writableEnded) {
            return res.status(500).json({ error: `Error: Failed to start dip process. ${spawnError.message}` });
        }
    });
    
    dipProcess.on('exit', (code, signal) => {
        console.log(`dip process exited with code ${code} and signal ${signal}.`);
    });

    dipProcess.on('close', (dipCode) => {
        console.log(`dip process stream closed, exit code ${dipCode}.`);
        if (dipStderrData) {
            console.log(`--- Full dip stderr START ---\n${dipStderrData}\n--- Full dip stderr END ---`);
        }

        if (dipCode !== 0) {
            if (!res.headersSent && !res.writableEnded) {
                 return res.status(500).json({ error: `Error: dip process exited with code ${dipCode}. Stderr: ${dipStderrData || 'No stderr output from dip.'}`});
            }
            return;
        }
        
        console.log('dip stdout (will be mapit stdin):\n---START DIP STDOUT---\n' + dipStdoutData + '\n---END DIP STDOUT---');

        const mapitEnv = {
            ...process.env,
            MAPPS: MAPPS_ENV_VAR,
            MAPINFO: MAPINFO_ENV_VAR,
        };

        console.log('Spawning mapit with environment:', mapitEnv);
        const mapitProcess = spawn(MAPIT_CLI_PATH, [], { env: mapitEnv });

        let mapitOutput = Buffer.alloc(0);
        let mapitStderrDataCollector = ''; // Renamed to avoid conflict

        mapitProcess.stdin.on('error', (err) => {
            console.error('ERROR on mapitProcess.stdin:', err);
            if (!res.headersSent && !res.writableEnded) {
                res.status(500).json({ error: `Error writing to mapit process stdin: ${err.message}` });
            }
        });

        mapitProcess.stdout.on('data', (data) => {
            mapitOutput = Buffer.concat([mapitOutput, data]);
        });
        
        mapitProcess.stderr.on('data', (data) => {
            const errChunk = data.toString();
            console.log(`mapit stderr: ${errChunk}`);
            mapitStderrDataCollector += errChunk;
        });

        mapitProcess.on('error', (spawnError) => {
            console.error('Failed to start mapit process (spawn error):', spawnError);
            if (!res.headersSent && !res.writableEnded) {
                res.status(500).json({ error: `Error: Failed to start mapit process. ${spawnError.message}` });
            } else if (!res.writableEnded) {
                res.destroy(new Error(`Failed to start mapit process. ${spawnError.message}`));
            }
        });

        mapitProcess.on('exit', (code, signal) => { // Use exit to get exitCode for mapit
            console.log(`mapit process exited with code ${code} and signal ${signal}.`);
            mapitProcess.exitCode = code; // Store for later use in stdout.on('end')
        });

        mapitProcess.stdout.on('end', () => {
            console.log('mapit process stdout stream ended. Total PostScript data length:', mapitOutput.length);
            if (mapitOutput.length === 0) {
                console.error('Error: mapit produced no output.');
                if (res.headersSent) {
                    console.error('mapitOutput.on(end): Headers already sent, cannot send mapit error.');
                    return;
                }
                res.setHeader('Content-Type', 'application/json');
                if (mapitProcess.exitCode !== 0) {
                     res.status(500).json({
                        error: 'mapit produced no output and exited with an error.',
                        details: `mapit process exited with code ${mapitProcess.exitCode}.`,
                        stderr: mapitStderrDataCollector || 'No stderr output from mapit.'
                    });
                } else {
                    res.status(500).json({
                        error: 'mapit produced no output.',
                        details: 'mapit process completed successfully but produced no data.',
                        stderr: mapitStderrDataCollector || 'No stderr output from mapit.'
                    });
                }
                return;
            }

            const gsArgs = ['-q', '-sDEVICE=pngalpha', '-r300', '-dSAFER', '-o', '-', '-'];
            console.log('Spawning Ghostscript process: gs', gsArgs.join(' '));
            const gsProcess = spawn('gs', gsArgs);

            let gsStderrData = '';
            let gsOutput = Buffer.alloc(0);
            gsProcess.stderr.on('data', (data) => {
                const errChunk = data.toString();
                console.error(`gs stderr chunk: ${errChunk}`);
                gsStderrData += errChunk;
            });
            gsProcess.stdout.on('data', (data) => {
                gsOutput = Buffer.concat([gsOutput, data]);
            });

            gsProcess.on('close', (gsCode) => {
                console.log(`Ghostscript process stream closed, exit code ${gsCode}.`);
                if (gsStderrData) {
                    console.log(`--- Full gs stderr START ---\n${gsStderrData}\n--- Full gs stderr END ---`);
                }
                if (res.headersSent) {
                    console.error('gsProcess close: Headers already sent.');
                    if (!res.writableEnded) res.end();
                    return;
                }
                if (gsCode === 0 && gsOutput.length >= 8 && gsOutput.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
                    const base64Png = gsOutput.toString('base64');
                    res.setHeader('Content-Type', 'application/json');
                    res.json({ image: base64Png });
                } else {
                    res.setHeader('Content-Type', 'application/json');
                    const errorMessage = `Ghostscript error. Code: ${gsCode}. Output was not a valid PNG or output was empty.`;
                    console.error(errorMessage + ' Stderr: ' + (gsStderrData || 'N/A'));
                    res.status(500).json({
                        error: 'Ghostscript did not produce a valid PNG.',
                        details: `Ghostscript process exited with code ${gsCode}. Output length: ${gsOutput.length}.`,
                        stderr: gsStderrData || 'No stderr output from Ghostscript.',
                        gsOutputPreview: gsOutput.slice(0, 100).toString()
                    });
                }
            });
            
            gsProcess.stdin.on('error', (err) => {
                console.error('ERROR on gsProcess.stdin:', err);
                if (!res.headersSent && !res.writableEnded) {
                    res.setHeader('Content-Type', 'application/json');
                    res.status(500).json({ error: 'Error writing to Ghostscript process stdin.', details: err.message });
                }
                if (!gsProcess.killed) gsProcess.kill();
            });

            console.log('Piping mapit output to Ghostscript stdin.');
            gsProcess.stdin.write(mapitOutput);
            gsProcess.stdin.end();
        });

        // mapitProcess.on('close') remains mostly for logging mapit's own exit,
        // the primary response logic is now in mapitProcess.stdout.on('end')
        mapitProcess.on('close', (mapitCode) => {
            console.log(`mapit process stream closed, exit code ${mapitCode}.`);
            if (mapitStderrDataCollector) {
                console.log(`--- Full mapit stderr START ---\n${mapitStderrDataCollector}\n--- Full mapit stderr END ---`);
            }
            if (mapitCode !== 0 && mapitOutput.length === 0) { // If mapit failed AND produced no output
                console.error(`Error: mapit process exited with code ${mapitCode} and produced no output.`);
                if (!res.headersSent && !res.writableEnded) {
                    res.status(500).json({ error: `Error: mapit process exited with code ${mapitCode} and produced no output. Stderr: ${mapitStderrDataCollector || 'No stderr output from mapit.'}`});
                }
            }
            // If mapit has output, the stdout.on('end') handler for mapit takes care of GS and response.
        });

        console.log('Writing dip output to mapit stdin.');
        mapitProcess.stdin.write(dipStdoutData);
        mapitProcess.stdin.end();
    });

    console.log('Attempting to write to dip stdin:\n---START DIP STDIN---\n' + dipStdinDynamicContent + '---END DIP STDIN---');
    const writeSuccessful = dipProcess.stdin.write(dipStdinDynamicContent);
    if (writeSuccessful) {
        dipProcess.stdin.end();
        console.log('Successfully wrote to dip stdin and closed it.');
    } else {
        console.warn('dipProcess.stdin.write returned false (kernel buffer full). Waiting for drain event.');
        dipProcess.stdin.once('drain', () => {
            console.log('dipProcess.stdin drained. Now ending stdin.');
            dipProcess.stdin.end();
        });
    }
});

// API endpoint to execute DIP commands
app.post('/api/execute-dip-command', (req, res) => {
    console.log('Received request to /api/execute-dip-command');
    const { commandBlock, email, subject, gameName } = req.body; // gameName is also available from body

    if (!commandBlock || !email || !subject) {
        return res.status(400).json({ error: 'Missing commandBlock, email, or subject in request body.' });
    }

    console.log(`Raw cookies received: ${req.headers.cookie}`); // Log the entire cookie string
    const playerPowerCookie = getCookieValue(req.headers.cookie, 'machHelperPlayerPower'); // Use top-level function
    console.log(`Player Power Cookie (parsed): ${playerPowerCookie}`);

    // Construct the input for the dip CLI
    // This is similar to /generate-map but uses the provided commandBlock
    // and doesn't necessarily need the "SIGNON/SIGNOFF" if commandBlock already includes it.
    // The frontend script.js currently wraps SIGNON/SIGNOFF around existingCommands.
    const dipStdinContent = `FROM: ${email}
TO: ${DIP_TO_EMAIL}
Subject: ${subject}
Date: ${new Date().toUTCString()}

${commandBlock}
`; // Note: Frontend already adds SIGNON and SIGNOFF

    console.log(`Spawning dip process for command execution: ${DIP_CLI_PATH} ${DIP_CLI_ARGS.join(' ')} with CWD: ${DIP_CLI_CWD}`);
    const dipProcess = spawn(DIP_CLI_PATH, DIP_CLI_ARGS, { cwd: DIP_CLI_CWD });

    let dipStdoutData = '';
    let dipStderrData = '';

    dipProcess.stdin.on('error', (err) => {
        console.error('ERROR on dipProcess.stdin for command execution:', err);
        if (!res.headersSent && !res.writableEnded) {
            res.status(500).json({ error: `Error writing to dip process stdin: ${err.message}`, stderr: dipStderrData });
        }
    });

    dipProcess.stdout.on('data', (data) => {
        dipStdoutData += data.toString();
    });

    dipProcess.stderr.on('data', (data) => {
        const errChunk = data.toString();
        console.error(`dip stderr chunk (command execution): ${errChunk}`);
        dipStderrData += errChunk;
    });

    dipProcess.on('error', (spawnError) => {
        console.error('Failed to start dip process for command execution (spawn error):', spawnError);
        if (!res.headersSent && !res.writableEnded) {
            return res.status(500).json({ error: `Error: Failed to start dip process. ${spawnError.message}`, stderr: dipStderrData });
        }
    });

    dipProcess.on('close', (dipCode) => {
        console.log(`dip process (command execution) stream closed, exit code ${dipCode}.`);
        if (dipStderrData) {
            console.log(`--- Full dip stderr (command execution) START ---\n${dipStderrData}\n--- Full dip stderr (command execution) END ---`);
        }

        if (res.headersSent || res.writableEnded) {
            console.log('Response already sent for /api/execute-dip-command');
            return;
        }

        if (dipCode === 0) {
            console.log('dip command execution successful. Stdout:\n', dipStdoutData);
            // Primary command successful, now check for master player and run secondary command
            if (playerPowerCookie === 'M') {
                console.log('Master player detected (playerPower=M). Executing secondary dip command.');
                const secondaryDipArgs = ['-C', DIP_CLI_CWD, '-x']; // Align with -C flag usage
                const commandString = `${DIP_CLI_PATH} ${secondaryDipArgs.join(' ')}`;
                console.log(`Spawning secondary dip process with bash shell: ${commandString} with CWD: ${DIP_CLI_CWD}`);
                const secondaryDipProcess = spawn(commandString, [], { cwd: DIP_CLI_CWD, shell: '/bin/bash' });

                let secondaryDipStdout = '';
                let secondaryDipStderr = '';

                secondaryDipProcess.stdout.on('data', (data) => {
                    secondaryDipStdout += data.toString();
                });
                secondaryDipProcess.stderr.on('data', (data) => {
                    secondaryDipStderr += data.toString();
                });
                secondaryDipProcess.on('error', (spawnError) => {
                    console.error('Failed to start secondary dip process (spawn error):', spawnError);
                    // Still send primary response, but indicate secondary process error
                    if (!res.headersSent && !res.writableEnded) {
                        res.json({
                            stdout: dipStdoutData,
                            stderr: dipStderrData,
                            secondaryError: `Failed to start secondary process: ${spawnError.message}`
                        });
                    }
                });
                secondaryDipProcess.on('close', (secDipCode) => {
                    console.log(`Secondary dip process exited with code ${secDipCode}.`);
                    if (secondaryDipStdout) {
                        console.log(`Secondary dip stdout:\n${secondaryDipStdout}`);
                    }
                    if (secondaryDipStderr) {
                        console.error(`Secondary dip stderr:\n${secondaryDipStderr}`);
                    }
                    // Send response including secondary process output
                    if (!res.headersSent && !res.writableEnded) {
                        res.json({
                            stdout: dipStdoutData,
                            stderr: dipStderrData,
                            secondaryStdout: secondaryDipStdout,
                            secondaryStderr: secondaryDipStderr,
                            secondaryExitCode: secDipCode
                        });
                    }
                });
            } else {
                // Not a master player, send only primary command output
                if (!res.headersSent && !res.writableEnded) {
                    res.json({ stdout: dipStdoutData, stderr: dipStderrData });
                }
            }
        } else {
            console.error(`Error: dip process (command execution) exited with code ${dipCode}.`);
            res.status(500).json({
                error: `dip process exited with code ${dipCode}.`,
                details: `Review server logs for more details. Game: ${gameName || 'N/A'}`,
                stdout: dipStdoutData, // Include stdout even on error, might be useful
                stderr: dipStderrData || 'No stderr output from dip.'
            });
        }
    });

    console.log('Attempting to write to dip stdin (command execution):\n---START DIP STDIN---\n' + dipStdinContent + '---END DIP STDIN---');
    const writeSuccessful = dipProcess.stdin.write(dipStdinContent);
    if (writeSuccessful) {
        dipProcess.stdin.end();
        console.log('Successfully wrote to dip stdin (command execution) and closed it.');
    } else {
        console.warn('dipProcess.stdin.write (command execution) returned false. Waiting for drain event.');
        dipProcess.stdin.once('drain', () => {
            console.log('dipProcess.stdin (command execution) drained. Now ending stdin.');
            dipProcess.stdin.end();
        });
    }
});

// Serve the main HTML file for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    console.log(`Visit http://localhost:${port} to use the Order Helper and Map Generator.`);
});