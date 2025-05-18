const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises; // Use promise version for async/await
const fsSync = require('fs'); // For synchronous checks like existsSync and mkdirSync
const cookieParser = require('cookie-parser');

const app = express();
const port = 3000;

// --- Configuration ---
const MAP_DATA_FILE_PATH = '/home/judge/data/map.machiavelli';
const CACHED_MAPS_DIR = path.join(__dirname, 'cached_maps');

const DIP_CLI_PATH = '/home/judge/dip';
const DIP_CLI_ARGS = ['-C', '/home/judge', '-w'];
const DIP_CLI_CWD = path.dirname(DIP_CLI_PATH);

const MAPIT_CLI_PATH = '/home/judge/flocscripts/mapit/mapit';
const MAPPS_ENV_VAR = '/home/judge/flocscripts/mapit/maps/Machiavelli.cmap.ps';
const MAPINFO_ENV_VAR = '/home/judge/flocscripts/mapit/maps/Machiavelli.info';

const DIP_FROM_EMAIL = "me@jonmarkgo.com";
const DIP_TO_EMAIL = "jonmarkgodiplomacyadjudicator@gmail.com";
const DIP_SUBJECT = "map"; // Default subject, can be overridden
// --- End Configuration ---

// --- Input Validation Utility ---
const INVALID_DIP_CHAR_PATTERN = /[^a-zA-Z0-9\s\-\/:@,\.]/; // Added @, ,, and .
const ALLOWED_CHARS_DESC = "Allowed characters: letters, numbers, spaces, '-', '/', ':', '@', ',', '.'."; // Added @, ,, and .

function validateDipInputContent(contentToValidate) {
    const lines = contentToValidate.split('\n');
    const invalidLinesFound = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trimEnd(); // Check the content of each line
        if (line && INVALID_DIP_CHAR_PATTERN.test(line)) { // Test non-empty lines
            invalidLinesFound.push(`Line ${i + 1}: ${line}`);
        }
    }

    if (invalidLinesFound.length > 0) {
        return { isValid: false, invalidLines: invalidLinesFound };
    }
    return { isValid: true };
}
// --- End Input Validation Utility ---

// Ensure cache directory exists
if (!fsSync.existsSync(CACHED_MAPS_DIR)) {
    try {
        fsSync.mkdirSync(CACHED_MAPS_DIR, { recursive: true });
        console.log(`Created cache directory: ${CACHED_MAPS_DIR}`);
    } catch (err) {
        console.error(`Failed to create cache directory ${CACHED_MAPS_DIR}:`, err);
        // Depending on severity, you might want to exit or handle this differently
    }
}

// --- Shared DIP Process Spawner ---
async function spawnDipProcess(stdinContent, customArgs = DIP_CLI_ARGS, customCwd = DIP_CLI_CWD, useShell = false) {
    // Final validation layer directly before spawning the process
    const validationResult = validateDipInputContent(stdinContent);
    if (!validationResult.isValid) {
        const errorMessage = `Refused to spawn DIP process due to invalid characters in stdin. ${ALLOWED_CHARS_DESC}\nInvalid lines:\n${validationResult.invalidLines.join('\n')}`;
        console.error(`[spawnDipProcessValidation] ${errorMessage}`);
        return Promise.reject({
            error: 'Invalid characters in DIP process input.',
            details: errorMessage,
            invalidLines: validationResult.invalidLines, // Pass along for potential API response
            type: 'dip_stdin_validation_error'
        });
    }
    // End of final validation layer

    return new Promise((resolve, reject) => {
        console.log(`Spawning dip process: ${DIP_CLI_PATH} ${customArgs.join(' ')} with CWD: ${customCwd}${useShell ? ' (using shell)' : ''}`);
        const dipProcess = spawn(DIP_CLI_PATH, customArgs, { cwd: customCwd, shell: useShell ? '/bin/bash' : undefined });

        let stdoutData = '';
        let stderrData = '';

        dipProcess.stdin.on('error', (err) => {
            console.error('ERROR on dipProcess.stdin:', err);
            if (!dipProcess.killed) dipProcess.kill();
            // Reject with an object structure consistent with other rejections
            reject({ error: `Error writing to dip process stdin: ${err.message}`, stdout: stdoutData, stderr: stderrData, exitCode: null, type: 'dip_stdin_error' });
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
            reject({ error: `Failed to start dip process: ${spawnError.message}`, stdout: stdoutData, stderr: stderrData, exitCode: null, type: 'dip_spawn_error' });
        });

        dipProcess.on('close', (code, signal) => {
            console.log(`dip process stream closed, exit code ${code}, signal ${signal}.`);
            if (stderrData) {
                console.log(`--- Full dip stderr START ---\n${stderrData}\n--- Full dip stderr END ---`);
            }
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

async function getGamePhase(gameName) {
    console.log(`[getGamePhase] Getting phase for game: ${gameName}`);
    if (!gameName) {
        console.error('[getGamePhase] No gameName provided.');
        throw new Error('Game name is required to get phase.');
    }

    const listCommand = `LIST ${gameName}`;
    const dipStdinContent = `FROM: ${DIP_FROM_EMAIL}
TO: ${DIP_TO_EMAIL}
Subject: PhaseCheck for ${gameName}
Date: ${new Date().toUTCString()}

${listCommand}
SIGN OFF
`;

    try {
        const dipResult = await spawnDipProcess(dipStdinContent);
        if (!dipResult.success) {
            console.error(`[getGamePhase] dip process for LIST failed. Exit code: ${dipResult.exitCode}, Stderr: ${dipResult.stderr}`);
            throw new Error(`Failed to get game phase. DIP LIST command failed: ${dipResult.stderr || 'Unknown error from dip LIST'}`);
        }

        const stdout = dipResult.stdout;
        const phaseRegex = /Game '[^']+' order #\d+ \(([A-Z]\d+[A-Z])\)/;
        const match = stdout.match(phaseRegex);

        if (match && match[1]) {
            const phase = match[1];
            console.log(`[getGamePhase] Extracted phase: ${phase} for game ${gameName}`);
            return phase;
        } else {
            const deadlinePhaseRegex = /:: Deadline: ([A-Z]\d+[A-Z])/;
            const deadlineMatch = stdout.match(deadlinePhaseRegex);
            if (deadlineMatch && deadlineMatch[1]) {
                const phase = deadlineMatch[1];
                console.log(`[getGamePhase] Extracted phase from deadline: ${phase} for game ${gameName}`);
                return phase;
            }
            console.error(`[getGamePhase] Could not extract phase from LIST output for ${gameName}. Output snippet: ${stdout.substring(0, 500)}`);
            throw new Error('Could not extract phase from LIST command output.');
        }
    } catch (error) {
        console.error(`[getGamePhase] Error during LIST command execution or parsing for ${gameName}: ${error.message}`);
        // Ensure the error is an instance of Error for consistent handling
        if (error instanceof Error) {
            throw error;
        } else {
            throw new Error(String(error.error || error.message || error));
        }
    }
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));
// Serve cached maps statically
app.use('/cached_maps', express.static(path.join(__dirname, 'cached_maps')));
app.use(express.json());
app.use(cookieParser());

app.get('/api/map-file-data', (req, res) => {
    fs.readFile(MAP_DATA_FILE_PATH, 'utf8')
        .then(data => res.type('text/plain').send(data))
        .catch(err => {
            console.error(`Error reading map data file (${MAP_DATA_FILE_PATH}):`, err);
            res.status(500).send('Error reading map data file.');
        });
});

app.get('/generate-map', async (req, res) => {
    console.log('Received request to /generate-map');

    const cookieGameName = req.cookies.machHelperGameName;
    const requestedGameName = req.query.gameName || cookieGameName || "machtest12345";

    let currentPhase;
    try {
        currentPhase = await getGamePhase(requestedGameName);
    } catch (phaseError) {
        console.error(`Failed to get game phase for ${requestedGameName}: ${phaseError.message}`);
        return res.status(500).json({
            error: `Failed to determine game phase for "${requestedGameName}"`,
            details: phaseError.message,
            type: 'phase_error'
        });
    }

    const gameSpecificCacheDir = path.join(CACHED_MAPS_DIR, requestedGameName);
    const cachedImageFileName = `${currentPhase}.png`;
    const cachedImagePath = path.join(gameSpecificCacheDir, cachedImageFileName);

    try {
        // Ensure the game-specific cache directory exists
        if (!fsSync.existsSync(gameSpecificCacheDir)) {
            try {
                await fs.mkdir(gameSpecificCacheDir, { recursive: true });
                console.log(`Created game-specific cache directory: ${gameSpecificCacheDir}`);
            } catch (mkdirError) {
                console.error(`Failed to create game-specific cache directory ${gameSpecificCacheDir}:`, mkdirError);
                // Decide if we should throw or try to proceed without caching for this request
                // For now, let's log and proceed; map generation will occur, just not caching.
            }
        }

        if (fsSync.existsSync(cachedImagePath)) {
            console.log(`Cache hit: Found ${cachedImagePath} for phase ${currentPhase}, game ${requestedGameName}. Serving URL.`);
            // Construct the URL relative to the domain root
            const imageUrl = `/cached_maps/${requestedGameName}/${cachedImageFileName}`;
            return res.json({
                imageUrl: imageUrl,
                source: 'cache',
                phase: currentPhase,
                gameName: requestedGameName
            });
        }
        console.log(`Cache miss: ${cachedImagePath} not found for phase ${currentPhase}, game ${requestedGameName}. Generating new map.`);
    } catch (cacheReadError) {
        console.error(`Error accessing or reading cached image ${cachedImagePath}: ${cacheReadError.message}. Proceeding to generate.`);
    }

    const dipCoreCommand = `list ${requestedGameName}`;
    const dipStdinDynamicContent = `FROM: ${DIP_FROM_EMAIL}
TO: ${DIP_TO_EMAIL}
Subject: ${DIP_SUBJECT} (MapGen for ${requestedGameName} - ${currentPhase})
Date: ${new Date().toUTCString()}

${dipCoreCommand}
SIGN OFF
`;

    try {
        const dipResult = await spawnDipProcess(dipStdinDynamicContent);

        if (!dipResult.success) {
            throw { // Throw an object to be caught by the outer catch
                type: 'dip_mapgen_error',
                error: `dip process for map generation exited with code ${dipResult.exitCode}.`,
                stderr: dipResult.stderr || 'No stderr output from dip.',
                details: `Game: ${requestedGameName}, Phase: ${currentPhase}`
            };
        }

        console.log('dip stdout (will be mapit stdin):\n---START DIP STDOUT---\n' + dipResult.stdout.substring(0, 500) + '...\n---END DIP STDOUT---');

        const mapitEnv = { ...process.env, MAPPS: MAPPS_ENV_VAR, MAPINFO: MAPINFO_ENV_VAR };
        const mapitProcess = spawn(MAPIT_CLI_PATH, [], { env: mapitEnv });

        let mapitOutput = Buffer.alloc(0);
        let mapitStderrDataCollector = '';

        mapitProcess.stdout.on('data', (data) => mapitOutput = Buffer.concat([mapitOutput, data]));
        mapitProcess.stderr.on('data', (data) => {
            const errChunk = data.toString();
            console.log(`mapit stderr: ${errChunk}`);
            mapitStderrDataCollector += errChunk;
        });

        await new Promise((resolveMapit, rejectMapit) => {
            mapitProcess.on('error', (spawnError) => rejectMapit({ type: 'mapit_spawn', error: `Failed to start mapit process: ${spawnError.message}` }));
            mapitProcess.stdin.on('error', (err) => rejectMapit({ type: 'mapit_stdin', error: `Error writing to mapit stdin: ${err.message}` }));

            mapitProcess.on('close', async (mapitCode) => {
                console.log(`mapit process closed, code ${mapitCode}. Stderr: ${mapitStderrDataCollector}`);
                if (mapitCode !== 0 || mapitOutput.length === 0) {
                    return rejectMapit({
                        type: 'mapit_execution',
                        error: 'mapit process failed or produced no output.',
                        details: `mapit code ${mapitCode}, output length ${mapitOutput.length}.`,
                        stderr: mapitStderrDataCollector
                    });
                }

                const gsArgs = ['-q', '-sDEVICE=pngalpha', '-r300', '-dSAFER', '-o', '-', '-'];
                const gsProcess = spawn('gs', gsArgs);
                let gsOutput = Buffer.alloc(0);
                let gsStderrData = '';

                gsProcess.stdout.on('data', (data) => gsOutput = Buffer.concat([gsOutput, data]));
                gsProcess.stderr.on('data', (data) => {
                    const errChunk = data.toString();
                    console.error(`gs stderr: ${errChunk}`);
                    gsStderrData += errChunk;
                });
                gsProcess.stdin.on('error', (err) => rejectMapit({ type: 'gs_stdin', error: `Error writing to gs stdin: ${err.message}` }));

                gsProcess.on('close', async (gsCode) => {
                    console.log(`gs process closed, code ${gsCode}. Stderr: ${gsStderrData}`);
                    if (gsCode === 0 && gsOutput.length >= 8 && gsOutput.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
                        try {
                            await fs.writeFile(cachedImagePath, gsOutput);
                            console.log(`Saved generated map to cache: ${cachedImagePath}`);
                        } catch (writeError) {
                            console.error(`Error saving map to cache ${cachedImagePath}: ${writeError.message}`);
                        }
                        // For newly generated images, send base64 directly for immediate display
                        res.json({
                            image: gsOutput.toString('base64'),
                            source: 'generated',
                            phase: currentPhase,
                            gameName: requestedGameName,
                            // Optionally, provide the future cache URL as well, though client might not use it immediately
                            // futureImageUrl: `/cached_maps/${requestedGameName}/${cachedImageFileName}`
                        });
                        resolveMapit();
                    } else {
                        rejectMapit({
                            type: 'gs_execution',
                            error: 'Ghostscript did not produce a valid PNG.',
                            details: `gs code ${gsCode}, output length ${gsOutput.length}.`,
                            stderr: gsStderrData,
                            gsOutputPreview: gsOutput.slice(0, 100).toString()
                        });
                    }
                });
                gsProcess.stdin.write(mapitOutput);
                gsProcess.stdin.end();
            });
            mapitProcess.stdin.write(dipResult.stdout);
            mapitProcess.stdin.end();
        });

    } catch (processError) {
        console.error('Error in map generation pipeline:', processError);
        if (!res.headersSent && !res.writableEnded) {
            res.status(500).json({
                error: processError.error || 'Map generation pipeline error.',
                details: processError.details || (processError.message || 'No details'),
                stderr: processError.stderr,
                type: processError.type || 'unknown_pipeline_error',
                gsOutputPreview: processError.gsOutputPreview
            });
        }
    }
});


app.post('/api/execute-dip-command', async (req, res) => {
    console.log('Received request to /api/execute-dip-command');
    const { commandBlock, email, subject, gameName } = req.body;

    if (!commandBlock || !email || !subject) {
        return res.status(400).json({ error: 'Missing commandBlock, email, or subject in request body.' });
    }

    // Backend validation for allowed characters in commandBlock
    const commandBlockValidation = validateDipInputContent(commandBlock);
    if (!commandBlockValidation.isValid) {
        console.warn('Backend validation failed for /api/execute-dip-command. Invalid lines:', commandBlockValidation.invalidLines);
        return res.status(400).json({
            error: 'Invalid characters in commands.',
            details: ALLOWED_CHARS_DESC,
            invalidLines: commandBlockValidation.invalidLines
        });
    }
    // End of backend validation

    const playerPowerCookie = req.cookies.machHelperPlayerPower;
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
            const secondaryDipArgs = ['-C', DIP_CLI_CWD, '-x'];
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
            if (!res.headersSent && !res.writableEnded) {
                res.json({ stdout: primaryDipResult.stdout, stderr: primaryDipResult.stderr, success: primaryDipResult.success, exitCode: primaryDipResult.exitCode });
            }
        }

    } catch (dipError) {
        console.error('Failed to execute dip process for /api/execute-dip-command:', dipError);
        if (!res.headersSent && !res.writableEnded) {
            return res.status(500).json({
                error: dipError.error || 'Error executing dip process.',
                stderr: dipError.stderr,
                type: dipError.type || 'dip_command_execution_error'
            });
        }
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});