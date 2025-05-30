document.addEventListener('DOMContentLoaded', () => {
    // --- DATA ---
    const powers = [
        { name: "Austria", letter: "A" },
        { name: "France", letter: "F" },
        { name: "Florence", letter: "L" },
        { name: "Milan", letter: "I" },
        { name: "Naples", letter: "N" },
        { name: "Papacy", letter: "P" },
        { name: "Turkey", letter: "T" },
        { name: "Venice", letter: "V" },
        { name: "Master", letter: "M" }
    ];

    const multiCoastalProvinces = {
        "PRO": { name: "Provence", coasts: ["NC", "SC"] },
        "CRO": { name: "Croatia", coasts: ["NC", "SC"] }
    };

    let provincesData = {};
    let viewerInstance = null;

    // --- UI ELEMENTS ---
    const gameNameEl = document.getElementById('gameName');
    const passwordEl = document.getElementById('password');
    const playerPowerEl = document.getElementById('playerPower');
    const playerEmailEl = document.getElementById('playerEmail'); // Added for email
    const saveSetupButton = document.getElementById('saveSetupButton');
    const clearSetupButton = document.getElementById('clearSetupButton');

    const unitTypeEl = document.getElementById('unitType');
    const unitLocationEl = document.getElementById('unitLocation');
    const unitCoastEl = document.getElementById('unitCoast');
    const orderTypeEl = document.getElementById('orderType');

    const moveFieldsEl = document.getElementById('moveFields');
    const moveTargetProvinceEl = document.getElementById('moveTargetProvince');
    const moveTargetCoastEl = document.getElementById('moveTargetCoast');
    const viaConvoyRouteEl = document.getElementById('viaConvoyRoute');

    const supportFieldsEl = document.getElementById('supportFields');
    const supportedUnitTypeEl = document.getElementById('supportedUnitType');
    const supportedUnitLocationEl = document.getElementById('supportedUnitLocation');
    const supportedUnitCoastEl = document.getElementById('supportedUnitCoast');
    const supportMoveFieldsEl = document.getElementById('supportMoveFields');
    const supportedMoveTargetProvinceEl = document.getElementById('supportedMoveTargetProvince');
    const supportedMoveTargetCoastEl = document.getElementById('supportedMoveTargetCoast');

    const convoyFieldsEl = document.getElementById('convoyFields');
    const convoyedArmyLocationEl = document.getElementById('convoyedArmyLocation');
    const convoyedArmyTargetProvinceEl = document.getElementById('convoyedArmyTargetProvince');

    const convertFieldsEl = document.getElementById('convertFields');
    const convertToUnitTypeEl = document.getElementById('convertToUnitType');
    const convertToCoastEl = document.getElementById('convertToCoast');

    const addOrderButton = document.getElementById('addOrderButton');
    const commandsAreaEl = document.getElementById('commandsArea');

    const adjustmentOrderActionEl = document.getElementById('adjustmentOrderAction');
    const buildOrderFieldsEl = document.getElementById('buildOrderFields');
    const buildSpecialTypeEl = document.getElementById('buildSpecialType');
    const buildUnitTypeEl = document.getElementById('buildUnitType');
    const buildLocationEl = document.getElementById('buildLocation');
    const buildCoastEl = document.getElementById('buildCoast');

    const maintainOrderFieldsEl = document.getElementById('maintainOrderFields');
    const maintainUnitTypeEl = document.getElementById('maintainUnitType');
    const maintainLocationEl = document.getElementById('maintainLocation');
    const maintainCoastEl = document.getElementById('maintainCoast');

    const removeOrderFieldsEl = document.getElementById('removeOrderFields');
    const removeUnitTypeEl = document.getElementById('removeUnitType');
    const removeLocationEl = document.getElementById('removeLocation');
    const removeCoastEl = document.getElementById('removeCoast');
    const addAdjustmentOrderButton = document.getElementById('addAdjustmentOrderButton');

    const expenditureNumberEl = document.getElementById('expenditureNumber');
    const expenditureTypeEl = document.getElementById('expenditureType');
    const expenditureAmountEl = document.getElementById('expenditureAmount');
    const expTargetUnitTypeDivEl = document.getElementById('expTargetUnitTypeDiv');
    const expTargetUnitTypeEl = document.getElementById('expTargetUnitType');
    const expTargetProvinceDivEl = document.getElementById('expTargetProvinceDiv');
    const expTargetProvinceEl = document.getElementById('expTargetProvince');
    const expTargetPowerDivEl = document.getElementById('expTargetPowerDiv');
    const expTargetPowerEl = document.getElementById('expTargetPower');
    const addExpenditureButton = document.getElementById('addExpenditureButton');

    const loanPayTypeEl = document.getElementById('loanPayType');
    const loanAmountEl = document.getElementById('loanAmount');
    const loanDurationDivEl = document.getElementById('loanDurationDiv');
    const loanDurationEl = document.getElementById('loanDuration');
    const loanTargetPlayerDivEl = document.getElementById('loanTargetPlayerDiv');
    const loanTargetPlayerEl = document.getElementById('loanTargetPlayer');
    const chitToGiveDivEl = document.getElementById('chitToGiveDiv');
    const chitToGiveEl = document.getElementById('chitToGive');
    const addLoanPayButton = document.getElementById('addLoanPayButton');

    const allyActionEl = document.getElementById('allyAction');
    const allyTargetPowerEl = document.getElementById('allyTargetPower');
    const addAllyButton = document.getElementById('addAllyButton');

    const copyCommandsButton = document.getElementById('copyCommandsButton');
    const clearCommandsButton = document.getElementById('clearCommandsButton');
    const executeCommandButton = document.getElementById('executeCommandButton');
    const listGameStateButton = document.getElementById('listGameStateButton');
    const cliOutputBoxEl = document.getElementById('cliOutputBox');

    const refreshMapButton = document.getElementById('refreshMapButton');
    const mapStatusEl = document.getElementById('mapStatus');
    const mapContainerDiv = document.getElementById('mapContainerDiv');


    // --- LOAD/SAVE GAME SETUP FROM/TO COOKIES ---
    function saveGameSetup() {
        const emailToSave = playerEmailEl.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailToSave && !emailRegex.test(emailToSave)) {
            alert('Invalid email format. Please correct it before saving.\nGame info (except email) will not be saved.');
            return; // Stop saving if email is present and invalid
        }

        Cookies.set('machHelperGameName', gameNameEl.value, { expires: 30, path: '/', sameSite: 'Lax' });
        Cookies.set('machHelperPassword', passwordEl.value, { expires: 30, path: '/', sameSite: 'Lax' });
        Cookies.set('machHelperPlayerPower', playerPowerEl.value, { expires: 30, path: '/', sameSite: 'Lax' });
        
        if (emailToSave) { // Only save email if it's valid (or was empty and now validly empty after trim)
            Cookies.set('machHelperPlayerEmail', emailToSave, { expires: 30, path: '/', sameSite: 'Lax' });
        } else {
            // If email field is cleared, remove the cookie
            Cookies.remove('machHelperPlayerEmail', { path: '/' });
        }
        alert('Game info saved!');
    }

    function loadGameSetup() {
        const savedGameName = Cookies.get('machHelperGameName');
        const savedPassword = Cookies.get('machHelperPassword');
        const savedPlayerPower = Cookies.get('machHelperPlayerPower');
        const savedPlayerEmail = Cookies.get('machHelperPlayerEmail');

        if (savedGameName) gameNameEl.value = savedGameName;
        if (savedPassword) passwordEl.value = savedPassword;
        if (savedPlayerPower) playerPowerEl.value = savedPlayerPower;
        if (savedPlayerEmail) playerEmailEl.value = savedPlayerEmail;
    }

    function clearSavedGameSetup() {
        Cookies.remove('machHelperGameName', { path: '/' });
        Cookies.remove('machHelperPassword', { path: '/' });
        Cookies.remove('machHelperPlayerPower', { path: '/' });
        Cookies.remove('machHelperPlayerEmail', { path: '/' });
        gameNameEl.value = "machtest12345";
        passwordEl.value = "secret";
        playerPowerEl.value = "A";
        if (playerEmailEl) playerEmailEl.value = "";
        alert('Saved game info cleared!');
    }

    if (saveSetupButton) saveSetupButton.addEventListener('click', saveGameSetup);
    if (clearSetupButton) clearSetupButton.addEventListener('click', clearSavedGameSetup);


    // --- PARSING map.machiavelli ---
    function parseMapMachiavelliData(mapDataString) {
        const lines = mapDataString.trim().split('\n');
        let readingProvinces = true;
        let currentProvinceAdj = null;

        for (const line of lines) {
            if (line.startsWith('#') || line.trim() === '') continue;
            if (line.trim() === '-1') {
                readingProvinces = false;
                currentProvinceAdj = null;
                continue;
            }

            if (readingProvinces) {
                const parts = line.split(',');
                if (parts.length < 2) continue;
                const fullName = parts[0].trim();
                const detailsAndAbbrsString = parts[1].trim();
                const detailsAndAbbrs = detailsAndAbbrsString.split(/\s+/);

                const rawAbbrs = detailsAndAbbrs.slice(1);
                const allAbbreviations = rawAbbrs.map(a => a.toUpperCase()).filter(a => a.length > 0);
                const mainAbbr = allAbbreviations.length > 0 ? allAbbreviations[0] : fullName.substring(0, 3).toUpperCase();

                 if (!mainAbbr) {
                    console.warn("Skipping province with no valid abbreviation:", fullName);
                    continue;
                }
                provincesData[mainAbbr] = {
                    name: fullName,
                    abbr: mainAbbr,
                    allAbbrs: allAbbreviations.length > 0 ? allAbbreviations : [mainAbbr],
                    adj: { land: [], sea: [], canal: [] },
                    coasts: multiCoastalProvinces[mainAbbr] ? multiCoastalProvinces[mainAbbr].coasts : []
                };
            } else if (currentProvinceAdj === null && (line.includes('-mv:') || line.includes('-xc:') || line.includes('-cc:'))) {
                const provAbbr = line.substring(0, line.indexOf('-')).trim().toUpperCase();
                currentProvinceAdj = provAbbr;
                if (!provincesData[currentProvinceAdj]) {
                     provincesData[currentProvinceAdj] = { name: currentProvinceAdj, abbr: currentProvinceAdj, adj: { land: [], sea: [], canal: [] } };
                }
                processAdjLine(line, currentProvinceAdj);
            } else if (currentProvinceAdj && (line.includes('-mv:') || line.includes('-xc:') || line.includes('-cc:'))) {
                const provAbbr = line.substring(0, line.indexOf('-')).trim().toUpperCase();
                 if (provAbbr !== currentProvinceAdj) {
                    currentProvinceAdj = provAbbr;
                     if (!provincesData[currentProvinceAdj]) {
                        provincesData[currentProvinceAdj] = { name: currentProvinceAdj, abbr: currentProvinceAdj, adj: { land: [], sea: [], canal: [] } };
                    }
                }
                processAdjLine(line, currentProvinceAdj);
            } else if (line.startsWith("Famine:") || line.startsWith("Plague:") || line.startsWith("Variable Income:") || line.startsWith("Ownership (city) ordering:") || line.startsWith("Center (province) order for summary report:") || line.startsWith("Storms:") || line.startsWith("Limits for Units Types:")) {
                currentProvinceAdj = null;
            }
        }
    }

    function processAdjLine(line, provAbbr) {
        if (!provincesData[provAbbr] || !provincesData[provAbbr].adj) return;
        const [_marker, typeAndAdjs] = line.split(':', 2);
        if (!typeAndAdjs) return;
        const adjs = typeAndAdjs.trim().split(/\s+/).map(a => a.toUpperCase().split('/')[0]);

        if (line.includes('-mv:')) {
            provincesData[provAbbr].adj.land = [...new Set([...(provincesData[provAbbr].adj.land || []), ...adjs])];
        } else if (line.includes('-xc:')) {
            provincesData[provAbbr].adj.sea = [...new Set([...(provincesData[provAbbr].adj.sea || []), ...adjs])];
        } else if (line.includes('-cc:')) {
            provincesData[provAbbr].adj.canal = [...new Set([...(provincesData[provAbbr].adj.canal || []), ...adjs])];
        }
    }

    // --- UI POPULATION ---
    function populateProvinceDropdowns() {
        const sortedProvinces = Object.values(provincesData)
            .filter(p => p.abbr && p.name && p.name !== "XXXXXX" && p.abbr !== "XXXXXX")
            .sort((a, b) => a.name.localeCompare(b.name));

        const selects = [
            unitLocationEl, moveTargetProvinceEl, supportedUnitLocationEl,
            supportedMoveTargetProvinceEl, convoyedArmyLocationEl, convoyedArmyTargetProvinceEl,
            expTargetProvinceEl,
            buildLocationEl, maintainLocationEl, removeLocationEl
        ];

        selects.forEach(select => {
            if (!select) return;
            select.innerHTML = '<option value="">-- Select Province --</option>';
            sortedProvinces.forEach(p => {
                const option = document.createElement('option');
                option.value = p.abbr;
                const abbrDisplay = p.allAbbrs && p.allAbbrs.length > 0 ? p.allAbbrs.join(', ') : p.abbr;
                option.textContent = `${p.name} (${abbrDisplay})`;
                select.appendChild(option);
            });
        });
    }

    function populatePowerDropdowns() {
        const powerSelects = [expTargetPowerEl, loanTargetPlayerEl, chitToGiveEl, allyTargetPowerEl];
        powerSelects.forEach(select => {
            select.innerHTML = '<option value="">-- Select Power --</option>';
            powers.forEach(p => {
                const option = document.createElement('option');
                option.value = p.letter;
                option.textContent = `${p.name} (${p.letter})`;
                select.appendChild(option);
            });
        });
    }


    // --- UI LOGIC ---
    if (orderTypeEl) orderTypeEl.addEventListener('change', () => {
        const order = orderTypeEl.value;
        moveFieldsEl.classList.add('hidden');
        supportFieldsEl.classList.add('hidden');
        supportMoveFieldsEl.classList.add('hidden');
        convoyFieldsEl.classList.add('hidden');
        convertFieldsEl.classList.add('hidden');
        if (supportedUnitCoastEl) supportedUnitCoastEl.classList.add('hidden');


        if (order === 'M') moveFieldsEl.classList.remove('hidden');
        else if (order === 'S_H') {
            supportFieldsEl.classList.remove('hidden');
            if (supportedUnitTypeEl.value === 'F' && supportedUnitCoastEl) supportedUnitCoastEl.classList.remove('hidden');
        } else if (order === 'S_M') {
            supportFieldsEl.classList.remove('hidden');
            supportMoveFieldsEl.classList.remove('hidden');
            if (supportedUnitTypeEl.value === 'F' && supportedUnitCoastEl) supportedUnitCoastEl.classList.remove('hidden');
        } else if (order === 'C') convoyFieldsEl.classList.remove('hidden');
        else if (order === 'CONV') convertFieldsEl.classList.remove('hidden');
    });

    if (supportedUnitTypeEl) supportedUnitTypeEl.addEventListener('change', () => {
        const order = orderTypeEl.value;
        if (order === 'S_H' || order === 'S_M') {
            if (supportedUnitTypeEl.value === 'F' && supportedUnitCoastEl) {
                supportedUnitCoastEl.classList.remove('hidden');
            } else if (supportedUnitCoastEl) {
                supportedUnitCoastEl.classList.add('hidden');
                supportedUnitCoastEl.value = "";
            }
        }
    });

    if (adjustmentOrderActionEl) adjustmentOrderActionEl.addEventListener('change', () => {
        const action = adjustmentOrderActionEl.value;
        buildOrderFieldsEl.classList.add('hidden');
        maintainOrderFieldsEl.classList.add('hidden');
        removeOrderFieldsEl.classList.add('hidden');
        if (buildCoastEl) buildCoastEl.classList.add('hidden');
        if (maintainCoastEl) maintainCoastEl.classList.add('hidden');
        if (removeCoastEl) removeCoastEl.classList.add('hidden');


        if (action === 'BUILD') {
            buildOrderFieldsEl.classList.remove('hidden');
            if (buildUnitTypeEl.value === 'F' && buildCoastEl) buildCoastEl.classList.remove('hidden');
        } else if (action === 'MAINTAIN') {
            maintainOrderFieldsEl.classList.remove('hidden');
            if (maintainUnitTypeEl.value === 'F' && maintainCoastEl) maintainCoastEl.classList.remove('hidden');
        } else if (action === 'REMOVE') {
            removeOrderFieldsEl.classList.remove('hidden');
            if (removeUnitTypeEl.value === 'F' && removeCoastEl) removeCoastEl.classList.remove('hidden');
        }
    });

    if (buildUnitTypeEl) buildUnitTypeEl.addEventListener('change', () => {
        if (buildUnitTypeEl.value === 'F' && buildCoastEl) buildCoastEl.classList.remove('hidden');
        else if (buildCoastEl) { buildCoastEl.classList.add('hidden'); buildCoastEl.value = ""; }
    });
    if (maintainUnitTypeEl) maintainUnitTypeEl.addEventListener('change', () => {
        if (maintainUnitTypeEl.value === 'F' && maintainCoastEl) maintainCoastEl.classList.remove('hidden');
        else if (maintainCoastEl) { maintainCoastEl.classList.add('hidden'); maintainCoastEl.value = ""; }
    });
    if (removeUnitTypeEl) removeUnitTypeEl.addEventListener('change', () => {
        if (removeUnitTypeEl.value === 'F' && removeCoastEl) removeCoastEl.classList.remove('hidden');
        else if (removeCoastEl) { removeCoastEl.classList.add('hidden'); removeCoastEl.value = ""; }
    });

    if (expenditureTypeEl) expenditureTypeEl.addEventListener('change', () => {
        const type = expenditureTypeEl.value;
        expTargetUnitTypeDivEl.classList.add('hidden');
        expTargetProvinceDivEl.classList.add('hidden');
        expTargetPowerDivEl.classList.add('hidden');
        expenditureAmountEl.disabled = false;
        expenditureAmountEl.value = '';

        if (type === "none") {
             expenditureAmountEl.disabled = true;
        } else if (["famine relief", "pacify rebellion", "rebellion"].includes(type)) {
            expTargetProvinceDivEl.classList.remove('hidden');
            expenditureAmountEl.disabled = true;
            if(type === "famine relief") expenditureAmountEl.value = 3;
            if(type === "pacify rebellion") expenditureAmountEl.value = 12;
            if(type === "rebellion") expenditureAmountEl.value = 9;
        } else if (["counter-bribe", "disband_unit", "buy_unit"].includes(type)) {
            expTargetUnitTypeDivEl.classList.remove('hidden');
            expTargetProvinceDivEl.classList.remove('hidden');
        } else if (["disband_auto_g", "buy_auto_g", "commit_g_auto", "disband_commit_g"].includes(type)) {
            expTargetProvinceDivEl.classList.remove('hidden');
        } else if (type === "assassinate") {
            expTargetPowerDivEl.classList.remove('hidden');
        }
    });

    if (loanPayTypeEl) loanPayTypeEl.addEventListener('change', () => {
        const type = loanPayTypeEl.value;
        loanDurationDivEl.classList.add('hidden');
        loanTargetPlayerDivEl.classList.add('hidden');
        chitToGiveDivEl.classList.add('hidden');
        loanAmountEl.disabled = false;
        loanAmountEl.value = '';

        if (type === "borrow") loanDurationDivEl.classList.remove('hidden');
        else if (type === "pay_player") loanTargetPlayerDivEl.classList.remove('hidden');
        else if (type === "give_chit") {
            chitToGiveDivEl.classList.remove('hidden');
            loanTargetPlayerDivEl.classList.remove('hidden');
            loanAmountEl.disabled = true;
        }
    });


    // --- COMMAND GENERATION ---
    function addCommandToOutput(command) {
        commandsAreaEl.value += command + '\n';
    }

    if (addOrderButton) addOrderButton.addEventListener('click', () => {
        const unitType = unitTypeEl.value;
        const unitLocAbbr = unitLocationEl.value;
        const unitCoast = unitType === 'F' ? unitCoastEl.value : "";
        const order = orderTypeEl.value;
        let command = "";

        if (!unitLocAbbr) { alert("Please select unit location."); return; }
        command += `${unitType} ${unitLocAbbr}${unitCoast} `;

        switch (order) {
            case 'H': command += 'H'; break;
            case 'M':
                const moveTarget = moveTargetProvinceEl.value;
                const moveTargetCoastVal = moveTargetCoastEl.value;
                const viaConvoy = viaConvoyRouteEl.value.trim();
                if (!moveTarget) { alert("Please select target province for move."); return; }
                command += "-";
                if (viaConvoy) {
                    const convoyPath = viaConvoy.toUpperCase().split(/[\s-]+/).filter(p => p.length > 0).join(' - ');
                    command += ` ${convoyPath} -`;
                }
                command += ` ${moveTarget}${moveTargetCoastVal}`;
                break;
            case 'S_H':
                const supHType = supportedUnitTypeEl.value;
                const supHLoc = supportedUnitLocationEl.value;
                const supHCoast = supHType === 'F' ? supportedUnitCoastEl.value : "";
                if (!supHLoc) { alert("Please select supported unit location."); return; }
                command += `S ${supHType} ${supHLoc}${supHCoast}`;
                break;
            case 'S_M':
                const supMType = supportedUnitTypeEl.value;
                const supMLoc = supportedUnitLocationEl.value;
                const supMCoast = supMType === 'F' ? supportedUnitCoastEl.value : "";
                const supMTarget = supportedMoveTargetProvinceEl.value;
                const supMTargetCoast = supportedMoveTargetCoastEl.value;
                if (!supMLoc || !supMTarget) { alert("Please select supported unit and target."); return; }
                command += `S ${supMType} ${supMLoc}${supMCoast} - ${supMTarget}${supMTargetCoast}`;
                break;
            case 'C':
                const convArmyLoc = convoyedArmyLocationEl.value;
                const convArmyTarget = convoyedArmyTargetProvinceEl.value;
                if (!convArmyLoc || !convArmyTarget) { alert("Please select convoyed army details."); return; }
                command += `T A ${convArmyLoc} - ${convArmyTarget}`;
                break;
            case 'CONV':
                const convertTo = convertToUnitTypeEl.value;
                const convertToCoastVal = (convertTo === 'F') ? convertToCoastEl.value : "";
                command += `C ${convertTo}${convertToCoastVal}`;
                break;
            case 'B': command += 'B'; break;
            case 'LIFT': command += 'LS'; break;
            case 'DISB': command += 'disband'; break;
        }
        addCommandToOutput(command.trim());
    });

    if (addAdjustmentOrderButton) addAdjustmentOrderButton.addEventListener('click', () => {
        const action = adjustmentOrderActionEl.value;
        let command = "";
        if (action === "BUILD") {
            const special = buildSpecialTypeEl.value;
            const unit = buildUnitTypeEl.value;
            const loc = buildLocationEl.value;
            const coast = (unit === 'F') ? buildCoastEl.value : "";
            if (!loc) { alert("Please select build location."); return; }
            command = "build ";
            if (special) command += `${special} `;
            command += `${unit} ${loc}${coast}`;
        } else if (action === "MAINTAIN") {
            const unit = maintainUnitTypeEl.value;
            const loc = maintainLocationEl.value;
            const coast = (unit === 'F') ? maintainCoastEl.value : "";
            if (!loc) { alert("Please select unit location to maintain."); return; }
            command = `maintain ${unit} ${loc}${coast}`;
        } else if (action === "REMOVE") {
            const unit = removeUnitTypeEl.value;
            const loc = removeLocationEl.value;
            const coast = (unit === 'F') ? removeCoastEl.value : "";
            if (!loc) { alert("Please select unit location to remove."); return; }
            command = `remove ${unit} ${loc}${coast}`;
        }
        addCommandToOutput(command.trim());
    });

    if (addExpenditureButton) addExpenditureButton.addEventListener('click', () => {
        const expNum = expenditureNumberEl.value;
        const expType = expenditureTypeEl.value;
        const expAmount = expenditureAmountEl.value;
        let command = `expense ${expNum}: `;
        if (expType === "none") {
            command += "none";
        } else {
            const amountToUse = expenditureAmountEl.disabled ? expenditureAmountEl.value : expAmount;
            if (!amountToUse && !expenditureAmountEl.disabled) { alert("Please enter expenditure amount."); return; }
            if (!expenditureAmountEl.disabled || ["counter-bribe", "disband_auto_g", "buy_auto_g", "commit_g_auto", "disband_commit_g", "disband_unit", "buy_unit", "assassinate"].includes(expType) ) {
                 if (!amountToUse) { alert("Please enter expenditure amount for this type."); return; }
                 command += `${amountToUse} ducats `;
            }
            let commandActionText = "";
            if (expType === "buy_auto_g") {
                commandActionText = "buy";
            } else if (expType === "commit_g_auto") {
                commandActionText = "gta";
            } else if (expType === "disband_auto_g" || expType === "disband_commit_g" || expType === "disband_unit") {
                commandActionText = "disband";
            } else {
                commandActionText = expType.replace(/_/g, ' ');
            }
            command += commandActionText;
            if (["counter-bribe", "disband_unit", "buy_unit"].includes(expType)) {
                const unit = expTargetUnitTypeEl.value;
                const prov = expTargetProvinceEl.value;
                if (!prov) { alert("Please select target province for expenditure."); return; }
                command += ` ${unit} ${prov}`;
            } else if (["disband_auto_g", "buy_auto_g", "commit_g_auto", "disband_commit_g"].includes(expType)) {
                const prov = expTargetProvinceEl.value;
                if (!prov) { alert("Please select target province for expenditure."); return; }
                command += ` G ${prov}`;
            } else if (["famine relief", "pacify rebellion", "rebellion"].includes(expType)) {
                const prov = expTargetProvinceEl.value;
                if (!prov) { alert("Please select target province for expenditure."); return; }
                command += ` ${prov}`;
            } else if (expType === "assassinate") {
                const power = expTargetPowerEl.value;
                if (!power) { alert("Please select target power for assassination."); return; }
                const powerName = powers.find(p => p.letter === power)?.name || power;
                command += ` ${powerName}`;
            }
        }
        addCommandToOutput(command.trim());
    });

    if (addLoanPayButton) addLoanPayButton.addEventListener('click', () => {
        const type = loanPayTypeEl.value;
        const amount = loanAmountEl.value;
        let command = "";
        if (type === "give_chit") {
            const chitOf = chitToGiveEl.value;
            const toPlayer = loanTargetPlayerEl.value;
            if (!chitOf || !toPlayer) { alert("Please select powers for chit trade."); return; }
            const chitName = powers.find(p => p.letter === chitOf)?.name || chitOf;
            const toPlayerName = powers.find(p => p.letter === toPlayer)?.name || toPlayer;
            command = `give ${chitName} to ${toPlayerName}`;
        } else {
            if (!amount && type !== "give_chit") { alert("Please enter amount."); return; }
            if (type === "borrow") {
                command = `borrow ${amount} ducats for ${loanDurationEl.value} year${loanDurationEl.value === '1' ? '' : 's'}`;
            } else if (type === "pay_bank") {
                command = `pay ${amount} ducats to bank`;
            } else if (type === "pay_player") {
                const target = loanTargetPlayerEl.value;
                if (!target) { alert("Please select target player for payment."); return; }
                const targetName = powers.find(p => p.letter === target)?.name || target;
                command = `pay ${amount} ducats to ${targetName}`;
            }
        }
        addCommandToOutput(command.trim());
    });

    if (addAllyButton) addAllyButton.addEventListener('click', () => {
        const action = allyActionEl.value;
        const target = allyTargetPowerEl.value;
        if (!target) { alert("Please select target power for alliance command."); return; }
        const targetName = powers.find(p => p.letter === target)?.name || target;
        addCommandToOutput(`${action} ${targetName}`);
    });

    if (copyCommandsButton) copyCommandsButton.addEventListener('click', () => {
        const game = gameNameEl.value.trim();
        const pass = passwordEl.value.trim();
        const powerLetter = playerPowerEl.value;

        if (!game || !pass || !powerLetter) {
            alert("Please fill in Game Name, Password, and Your Power in the Game Setup section before copying.");
            return;
        }

        const signOnCommand = `SIGNON ${powerLetter}${game} ${pass} machiavelli`;
        const signOffCommand = "SIGNOFF";

        let existingCommands = commandsAreaEl.value.trim();
        const fullCommandBlock = `${signOnCommand}\n${existingCommands ? existingCommands + '\n' : ''}${signOffCommand}`;
        commandsAreaEl.value = fullCommandBlock;

        navigator.clipboard.writeText(fullCommandBlock).then(() => {
            alert('Commands with SIGNON/SIGNOFF copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy commands: ', err);
            try {
                const textArea = document.createElement("textarea");
                textArea.value = fullCommandBlock;
                textArea.style.position = "fixed";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('Commands with SIGNON/SIGNOFF copied to clipboard (fallback method)!');
            } catch (e) {
                alert('Failed to copy commands. Please copy them manually.');
            }
        });
    });

    if (clearCommandsButton) clearCommandsButton.addEventListener('click', () => commandsAreaEl.value = '');

    // --- EXECUTE COMMAND LOGIC ---
    if (executeCommandButton) executeCommandButton.addEventListener('click', async () => {
        const game = gameNameEl.value.trim();
        const pass = passwordEl.value.trim();
        const powerLetter = playerPowerEl.value;
        const email = playerEmailEl.value.trim();

        if (!game || !pass || !powerLetter) {
            alert("Please fill in Game Name, Password, and Your Power in the Game Setup section before executing commands.");
            cliOutputBoxEl.value = "Execution failed: Game Name, Password, or Player Power not set.";
            return;
        }
        if (!email) {
            alert("Please fill in Your Email in the Game Setup section.");
            cliOutputBoxEl.value = "Execution failed: Player Email not set.";
            return;
        }

        let existingCommands = commandsAreaEl.value.trim();

        // Frontend validation for allowed characters in commands
        const commandLines = existingCommands.split('\n');
        const invalidCommandPattern = /[^a-zA-Z0-9\s\-\/:]/; // Pattern to find ANY disallowed character
        let invalidCommandsFound = [];

        for (let i = 0; i < commandLines.length; i++) {
            const line = commandLines[i].trim();
            // Only validate non-empty lines
            if (line && invalidCommandPattern.test(line)) {
                invalidCommandsFound.push(`Line ${i + 1}: ${line}`);
            }
        }

        if (invalidCommandsFound.length > 0) {
            const errorMsg = "Execution failed: Invalid characters in commands.\nAllowed: letters, numbers, spaces, '-', '/', ':'.\n\nInvalid lines:\n" + invalidCommandsFound.join("\n");
            alert(errorMsg);
            cliOutputBoxEl.value = errorMsg;
            return;
        }
        // End of validation

        if (!existingCommands) {
            alert("No commands to execute.");
            cliOutputBoxEl.value = "No commands entered to execute.";
            return;
        }

        const powerDetails = powers.find(p => p.letter === powerLetter);
        const powerName = powerDetails ? powerDetails.name : powerLetter;
        const subject = `DIP Web UI: ${powerName}`;

        const signOnCommand = `SIGNON ${powerLetter}${game} ${pass} machiavelli`;
        const signOffCommand = "SIGNOFF";

        const fullCommandBlock = `${signOnCommand}\n${existingCommands}\n${signOffCommand}`;

        cliOutputBoxEl.value = "Executing command... Please wait.";

        try {
            const response = await fetch('/api/execute-dip-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    commandBlock: fullCommandBlock,
                    email: email,
                    subject: subject,
                    gameName: game
                }),
            });

            const result = await response.json();

            if (response.ok) {
                let outputText = `Execution successful:\n\n${result.stdout || 'No output from command.'}`;
                if(result.stderr) {
                    outputText += `\n\nStderr:\n${result.stderr}`;
                }
                if (result.secondaryError) {
                    outputText += `\n\n--- Secondary Command ---\nError: ${result.secondaryError}`;
                } else if (result.secondaryStdout || result.secondaryStderr) {
                    outputText += `\n\n--- Secondary Command (Exit Code: ${result.secondaryExitCode === undefined ? 'N/A' : result.secondaryExitCode}) ---`;
                    if (result.secondaryStdout) outputText += `\nStdout:\n${result.secondaryStdout}`;
                    if (result.secondaryStderr) outputText += `\nStderr:\n${result.secondaryStderr}`;
                }
                cliOutputBoxEl.value = outputText;
            } else {
                let errorOutputText = `Execution failed: ${result.error || response.statusText}\n\nDetails:\n${result.details || ''}`;
                if (result.stdout) errorOutputText += `\n\nStdout (Primary):\n${result.stdout}`;
                if (result.stderr) errorOutputText += `\n\nStderr (Primary):\n${result.stderr}`;
                if (result.secondaryError) {
                    errorOutputText += `\n\n--- Secondary Command ---\nError: ${result.secondaryError}`;
                } else if (result.secondaryStdout || result.secondaryStderr) {
                    errorOutputText += `\n\n--- Secondary Command (Exit Code: ${result.secondaryExitCode === undefined ? 'N/A' : result.secondaryExitCode}) ---`;
                    if (result.secondaryStdout) errorOutputText += `\nStdout:\n${result.secondaryStdout}`;
                    if (result.secondaryStderr) errorOutputText += `\nStderr:\n${result.secondaryStderr}`;
                }
                cliOutputBoxEl.value = errorOutputText;
            }
        } catch (error) {
            console.error('Error executing command:', error);
            cliOutputBoxEl.value = `Error executing command: ${error.message}\n\nCheck console for more details.`;
        }
    });

    if (listGameStateButton) listGameStateButton.addEventListener('click', async () => {
        const game = gameNameEl.value.trim();
        const pass = passwordEl.value.trim();
        const powerLetter = playerPowerEl.value;
        const email = playerEmailEl.value.trim();

        if (!game || !pass || !powerLetter) {
            alert("Please fill in Game Name, Password, and Your Power in the Game Setup section.");
            cliOutputBoxEl.value = "LIST command failed: Game Name, Password, or Player Power not set.";
            return;
        }
        if (!email) {
            alert("Please fill in Your Email in the Game Setup section (required for API).");
            cliOutputBoxEl.value = "LIST command failed: Player Email not set.";
            return;
        }

        const powerDetails = powers.find(p => p.letter === powerLetter);
        const powerName = powerDetails ? powerDetails.name : powerLetter;
        const subject = `DIP Web UI LIST: ${powerName} for ${game}`;

        const signOnCommand = `SIGNON ${powerLetter}${game} ${pass} machiavelli`;
        const listCommand = `LIST ${game}`;
        const signOffCommand = "SIGNOFF";

        const fullCommandBlock = `${signOnCommand}\n${listCommand}\n${signOffCommand}`;

        cliOutputBoxEl.value = "Executing LIST command... Please wait.";

        try {
            const response = await fetch('/api/execute-dip-command', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    commandBlock: fullCommandBlock,
                    email: email,
                    subject: subject,
                    gameName: game
                }),
            });

            const result = await response.json();

            if (response.ok) {
                let listOutputText = `LIST command successful:\n\n${result.stdout || 'No output from command.'}`;
                if(result.stderr) listOutputText += `\n\nStderr:\n${result.stderr}`;
                if (result.secondaryError) {
                    listOutputText += `\n\n--- Secondary Command ---\nError: ${result.secondaryError}`;
                } else if (result.secondaryStdout || result.secondaryStderr) {
                    listOutputText += `\n\n--- Secondary Command (Exit Code: ${result.secondaryExitCode === undefined ? 'N/A' : result.secondaryExitCode}) ---`;
                    if (result.secondaryStdout) listOutputText += `\nStdout:\n${result.secondaryStdout}`;
                    if (result.secondaryStderr) listOutputText += `\nStderr:\n${result.secondaryStderr}`;
                }
                cliOutputBoxEl.value = listOutputText;
            } else {
                let listErrorOutputText = `LIST command failed: ${result.error || response.statusText}\n\nDetails:\n${result.details || ''}`;
                 if (result.stdout) listErrorOutputText += `\n\nStdout (Primary):\n${result.stdout}`;
                if (result.stderr) listErrorOutputText += `\n\nStderr (Primary):\n${result.stderr}`;
                if (result.secondaryError) {
                    listErrorOutputText += `\n\n--- Secondary Command ---\nError: ${result.secondaryError}`;
                } else if (result.secondaryStdout || result.secondaryStderr) {
                    listErrorOutputText += `\n\n--- Secondary Command (Exit Code: ${result.secondaryExitCode === undefined ? 'N/A' : result.secondaryExitCode}) ---`;
                    if (result.secondaryStdout) listErrorOutputText += `\nStdout:\n${result.secondaryStdout}`;
                    if (result.secondaryStderr) listErrorOutputText += `\nStderr:\n${result.secondaryStderr}`;
                }
                cliOutputBoxEl.value = listErrorOutputText;
            }
        } catch (error) {
            console.error('Error executing LIST command:', error);
            cliOutputBoxEl.value = `Error executing LIST command: ${error.message}\n\nCheck console for more details.`;
        }
    });

    // --- MAP DISPLAY LOGIC ---
    if (refreshMapButton) refreshMapButton.addEventListener('click', async () => {
        mapStatusEl.textContent = 'Generating map... Please wait.';
        mapStatusEl.classList.remove('text-danger');
        mapStatusEl.classList.add('text-info');
        refreshMapButton.disabled = true;

        if (viewerInstance) {
            viewerInstance.destroy();
            viewerInstance = null;
        }

        mapContainerDiv.innerHTML = '<div id="my-container" class="ng-scope pngobject-container" style="width:100%;">' +
                                    '<img src="" alt="Game Map" style="width:100%;height:auto;min-height:500px;object-fit:contain;display:block;margin:auto;" />' +
                                    '</div>';
        const imgElement = mapContainerDiv.querySelector('img');

        try {
            const currentGameName = gameNameEl.value.trim();
            const fetchUrl = `/generate-map${currentGameName ? '?gameName=' + encodeURIComponent(currentGameName) : ''}&t=${new Date().getTime()}`;

            const response = await fetch(fetchUrl);
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json(); 
                } catch (e) {
                    errorData = { error: await response.text() };
                }
                console.error('Map generation/fetch failed:', response.status, errorData);
                let errorMsg = `Map request failed: ${response.status}. Server: ${errorData.error || 'Unknown error'}.`;
                if(errorData.details) errorMsg += ` Details: ${errorData.details}.`;
                if(errorData.stderr) errorMsg += ` Stderr: ${errorData.stderr}.`;
                if(errorData.type) errorMsg += ` Type: ${errorData.type}.`;
                throw new Error(errorMsg);
            }
            const json = await response.json();
            let imageUrlToLoad;

            if (json.imageUrl) {
                // If a direct image URL is provided (from cache)
                imageUrlToLoad = json.imageUrl;
                console.log('Using cached image URL:', imageUrlToLoad);
            } else if (json.image) {
                // If base64 image data is provided (newly generated)
                imageUrlToLoad = 'data:image/png;base64,' + json.image;
                console.log('Using base64 image data for newly generated map.');
            } else {
                throw new Error('Map request failed: No image data or image URL in response.');
            }

            if (imgElement) {
                imgElement.src = imageUrlToLoad;
                if (typeof Viewer !== 'undefined') {
                    // Destroy previous instance if exists, before creating a new one
                    if (viewerInstance) {
                        viewerInstance.destroy();
                    }
                    viewerInstance = new Viewer(imgElement, {
                        inline: false,
                        toolbar: {
                            zoomIn: true, zoomOut: true, oneToOne: true, reset: true,
                            prev: false, play: false, next: false,
                            rotateLeft: true, rotateRight: true,
                            flipHorizontal: true, flipVertical: true,
                        },
                    });
                } else {
                    console.warn("Viewer.js not loaded, zoom/pan will not be available.");
                }
            }

            let statusMessage = `Map loaded (Game: ${json.gameName || 'N/A'}, Phase: ${json.phase || 'N/A'}). `;
            if (json.source === 'cache') {
                statusMessage += 'Served from cache. ';
            } else if (json.source === 'generated') {
                statusMessage += 'Newly generated and cached. ';
            }
            statusMessage += 'Refreshed: ' + new Date().toLocaleTimeString();
            mapStatusEl.textContent = statusMessage;
            mapStatusEl.classList.remove('text-info', 'text-danger');

        } catch (error) {
            console.error('Error fetching or displaying map:', error);
            mapStatusEl.textContent = 'Error: ' + error.message;
            mapStatusEl.classList.add('text-danger');
            if (imgElement) imgElement.src = "";
        } finally {
            refreshMapButton.disabled = false;
        }
    });

    // --- INITIALIZATION ---
    async function initializeApp() {
        try {
            loadGameSetup();

            const response = await fetch('/api/map-file-data');
            if (!response.ok) {
                throw new Error('Failed to load map file data: ' + response.statusText);
            }
            const mapDataText = await response.text();

            parseMapMachiavelliData(mapDataText);
            populateProvinceDropdowns();
            populatePowerDropdowns();

            if (orderTypeEl) orderTypeEl.dispatchEvent(new Event('change'));
            if (supportedUnitTypeEl) supportedUnitTypeEl.dispatchEvent(new Event('change'));
            if (adjustmentOrderActionEl) adjustmentOrderActionEl.dispatchEvent(new Event('change'));
            if (buildUnitTypeEl) buildUnitTypeEl.dispatchEvent(new Event('change'));
            if (maintainUnitTypeEl) maintainUnitTypeEl.dispatchEvent(new Event('change'));
            if (removeUnitTypeEl) removeUnitTypeEl.dispatchEvent(new Event('change'));
            if (expenditureTypeEl) expenditureTypeEl.dispatchEvent(new Event('change'));
            if (loanPayTypeEl) loanPayTypeEl.dispatchEvent(new Event('change'));

            const provinceDropdownsForChosen = [
                unitLocationEl, moveTargetProvinceEl, supportedUnitLocationEl,
                supportedMoveTargetProvinceEl, convoyedArmyLocationEl, convoyedArmyTargetProvinceEl,
                expTargetProvinceEl, buildLocationEl, maintainLocationEl, removeLocationEl
            ];

            provinceDropdownsForChosen.forEach(selectEl => {
                if (selectEl && typeof $.fn.chosen !== 'undefined') {
                    $(selectEl).chosen({ search_contains: true, width: "100%" });
                }
            });
            mapStatusEl.textContent = 'Map not yet loaded. Click "Refresh Map".';
            if (gameNameEl.value && refreshMapButton) { // Auto-refresh if game name is present
                refreshMapButton.click();
            }

        } catch (error) {
            console.error("Error initializing application:", error);
            alert("Error initializing application. Check console for details: " + error.message);
            mapStatusEl.textContent = 'Initialization error: ' + error.message;
            mapStatusEl.classList.add('text-danger');
        }
    }

    initializeApp();
});