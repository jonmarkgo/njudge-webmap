// server.js
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser'); // Added cookie-parser

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

// --- Shared DIP Process Spawner ---
async function spawnDipProcess(stdinContent, customArgs = DIP_CLI_ARGS, customCwd = DIP_CLI_CWD, useShell = false) {
    return new Promise((resolve, reject) => {
        console.log(`Spawning dip process: ${DIP_CLI_PATH} ${customArgs.join(' ')} with CWD: ${customCwd}${useShell ? ' (using shell)' : ''}`);
        const dipProcess = spawn(DIP_CLI_PATH, customArgs, { cwd: customCwd, shell: useShell ? '/bin/bash' : undefined });

        let stdoutData = '';
        let stderrData = '';

        dipProcess.stdin.on('error', (err) => {
            console.error('ERROR on dipProcess.stdin:', err);
            // Don't reject here, as the process might still exit and provide an exit code.
            // The 'error' event on the process itself will handle spawn failures.
            // However, if stdin write fails, it's a critical issue for this specific function.
            if (!dipProcess.killed) dipProcess.kill(); // Attempt to kill if stdin fails critically
            reject({ error: `Error writing to dip process stdin: ${err.message}`, stdout: stdoutData, stderr: stderrData, exitCode: null });
        });

        dipProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        dipProcess.stderr.on('data', (data) => {
            const errChunk = data.toString();
            console.error(`dip stderr chunk: ${errChunk}`);
            stderrData += errChunk;
        });

        dipProcess.on('error', (spawnError) => {
            console.error('Failed to start dip process (spawn error):', spawnError);
            reject({ error: `Failed to start dip process: ${spawnError.message}`, stdout: stdoutData, stderr: stderrData, exitCode: null });
        });

        dipProcess.on('close', (code, signal) => {
            console.log(`dip process stream closed, exit code ${code}, signal ${signal}.`);
            if (stderrData) {
                console.log(`--- Full dip stderr START ---\n${stderrData}\n--- Full dip stderr END ---`);
            }
            // 'close' is usually preferred over 'exit' for stdio streams.
            // If code is null and signal is present, it means the process was killed by a signal.
            const exitCode = code === null && signal ? `signal ${signal}` : code;
            if (code !== 0) {
                resolve({ stdout: stdoutData, stderr: stderrData, exitCode: exitCode, success: false });
            } else {
                resolve({ stdout: stdoutData, stderr: stderrData, exitCode: exitCode, success: true });
            }
        });
        
        console.log('Attempting to write to dip stdin:\n---START DIP STDIN---\n' + stdinContent + '---END DIP STDIN---');
        const writeSuccessful = dipProcess.stdin.write(stdinContent);
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
}
// --- End Shared DIP Process Spawner ---


// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser()); // Use cookie-parser middleware

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

app.get('/generate-map', async (req, res) => {
    console.log('Received request to /generate-map');

    const cookieGameName = req.cookies.machHelperGameName;
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

    try {
        const dipResult = await spawnDipProcess(dipStdinDynamicContent);

        if (!dipResult.success) {
            console.error(`Error: dip process exited with code ${dipResult.exitCode}. Stderr: ${dipResult.stderr}`);
            if (!res.headersSent && !res.writableEnded) {
                return res.status(500).json({ error: `Error: dip process exited with code ${dipResult.exitCode}.`, stderr: dipResult.stderr || 'No stderr output from dip.' });
            }
            return;
        }
        
        console.log('dip stdout (will be mapit stdin):\n---START DIP STDOUT---\n' + dipResult.stdout + '\n---END DIP STDOUT---');

        const mapitEnv = {
            ...process.env,
            MAPPS: MAPPS_ENV_VAR,
            MAPINFO: MAPINFO_ENV_VAR,
        };

        console.log('Spawning mapit with environment:', mapitEnv);
        const mapitProcess = spawn(MAPIT_CLI_PATH, [], { env: mapitEnv });

        let mapitOutput = Buffer.alloc(0);
        let mapitStderrDataCollector = '';

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

        mapitProcess.on('exit', (code, signal) => {
            console.log(`mapit process exited with code ${code} and signal ${signal}.`);
            mapitProcess.exitCode = code;
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

        mapitProcess.on('close', (mapitCode) => {
            console.log(`mapit process stream closed, exit code ${mapitCode}.`);
            if (mapitStderrDataCollector) {
                console.log(`--- Full mapit stderr START ---\n${mapitStderrDataCollector}\n--- Full mapit stderr END ---`);
            }
            if (mapitCode !== 0 && mapitOutput.length === 0) {
                console.error(`Error: mapit process exited with code ${mapitCode} and produced no output.`);
                if (!res.headersSent && !res.writableEnded) {
                    res.status(500).json({ error: `Error: mapit process exited with code ${mapitCode} and produced no output. Stderr: ${mapitStderrDataCollector || 'No stderr output from mapit.'}`});
                }
            }
        });

        console.log('Writing dip output to mapit stdin.');
        mapitProcess.stdin.write(dipResult.stdout);
        mapitProcess.stdin.end();

    } catch (dipError) {
        console.error('Failed to execute dip process for /generate-map:', dipError);
        if (!res.headersSent && !res.writableEnded) {
            return res.status(500).json({ error: dipError.error || 'Error executing dip process.', stderr: dipError.stderr });
        }
    }
});

// API endpoint to execute DIP commands
app.post('/api/execute-dip-command', async (req, res) => {
    console.log('Received request to /api/execute-dip-command');
    const { commandBlock, email, subject, gameName } = req.body;

    if (!commandBlock || !email || !subject) {
        return res.status(400).json({ error: 'Missing commandBlock, email, or subject in request body.' });
    }

    console.log(`Raw cookies received: ${req.headers.cookie}`);
    const playerPowerCookie = req.cookies.machHelperPlayerPower;
    console.log(`Player Power Cookie (parsed): ${playerPowerCookie}`);

    const dipStdinContent = `FROM: ${email}
TO: ${DIP_TO_EMAIL}
Subject: ${subject}
Date: ${new Date().toUTCString()}

${commandBlock}
`;

    try {
        const primaryDipResult = await spawnDipProcess(dipStdinContent);

        if (res.headersSent || res.writableEnded) {
            console.log('Response already sent for /api/execute-dip-command before processing primary dip result.');
            return;
        }

        if (!primaryDipResult.success) {
            console.error(`Error: dip process (command execution) exited with code ${primaryDipResult.exitCode}.`);
            return res.status(500).json({
                error: `dip process exited with code ${primaryDipResult.exitCode}.`,
                details: `Review server logs for more details. Game: ${gameName || 'N/A'}`,
                stdout: primaryDipResult.stdout,
                stderr: primaryDipResult.stderr || 'No stderr output from dip.'
            });
        }

        console.log('dip command execution successful. Stdout:\n', primaryDipResult.stdout);
        
        if (playerPowerCookie === 'M') {
            console.log('Master player detected (playerPower=M). Executing secondary dip command.');
            // For the secondary command, the command *is* the path and args, executed via shell
            // The `spawnDipProcess` expects DIP_CLI_PATH as the command, and then args.
            // So we need to adjust how we call it or what it expects for shell commands.
            // The original code was: spawn(commandString, [], { cwd: DIP_CLI_CWD, shell: '/bin/bash' });
            // where commandString = `${DIP_CLI_PATH} ${secondaryDipArgs.join(' ')}`
            // Let's make `spawnDipProcess` handle this by passing the full command string as `DIP_CLI_PATH` when `useShell` is true.
            // This is a slight deviation but keeps the function signature cleaner.
            // OR, more cleanly, the `spawn` function's first argument is the command, and second is args.
            // When shell is true, the first argument is the *entire command string*.
            // So, we can pass DIP_CLI_PATH as command, and secondaryDipArgs as args, and set useShell to true.
            // The original code `spawn(commandString, [], {shell: true})` is equivalent to `spawn(DIP_CLI_PATH, secondaryDipArgs, {shell: true})`
            // if `commandString` was just `DIP_CLI_PATH` and args were `secondaryDipArgs`.
            // The original code was `spawn(DIP_CLI_PATH + " " + secondaryDipArgs.join(' '), [], {shell: true})`
            // This is not quite right. If shell is true, the first arg is the command to run *in the shell*.
            // Let's stick to the original: `spawn(DIP_CLI_PATH, secondaryDipArgs, { cwd: DIP_CLI_CWD, shell: '/bin/bash' })`
            // So, `customArgs` will be `secondaryDipArgs`, and `useShell` will be `true`.
            
            const secondaryDipArgs = ['-C', DIP_CLI_CWD, '-x']; // Original args for the secondary command
            // No stdin for the secondary command as per original logic
            const secondaryDipResult = await spawnDipProcess("", secondaryDipArgs, DIP_CLI_CWD, true);


            if (!res.headersSent && !res.writableEnded) {
                res.json({
                    stdout: primaryDipResult.stdout,
                    stderr: primaryDipResult.stderr,
                    secondaryStdout: secondaryDipResult.stdout,
                    secondaryStderr: secondaryDipResult.stderr,
                    secondaryExitCode: secondaryDipResult.exitCode,
                    secondarySuccess: secondaryDipResult.success
                });
            }
        } else {
            // Not a master player, send only primary command output
            if (!res.headersSent && !res.writableEnded) {
                res.json({ stdout: primaryDipResult.stdout, stderr: primaryDipResult.stderr, success: primaryDipResult.success, exitCode: primaryDipResult.exitCode });
            }
        }

    } catch (dipError) {
        console.error('Failed to execute dip process for /api/execute-dip-command:', dipError);
        if (!res.headersSent && !res.writableEnded) {
            return res.status(500).json({ error: dipError.error || 'Error executing dip process.', stderr: dipError.stderr });
        }
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