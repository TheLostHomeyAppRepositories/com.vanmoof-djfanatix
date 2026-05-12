"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = require("homey");
const vanmoofcrypto_1 = __importDefault(require("./vanmoofcrypto"));
class vanmoofbike {
    constructor(bikeProfile, encryptionKey, userKeyId) {
        this.bikeProfile = bikeProfile;
        this.cryptService = new vanmoofcrypto_1.default(encryptionKey, this.isS2Profile() ? 12 : 6);
        //this.userKeyId = userKeyId not for S1
        //console.log('userKeyId', userKeyId)
        this.encryptionKey = encryptionKey;
        this.userKeyId = userKeyId;
        //const passcode = this.cryptService.getPasscode()
        //console.log('Passcode', passcode)
        // console.log('encryptionKey', encryptionKey)
        this.logger = new homey_1.SimpleClass();
    }
    async authenticate(bluetoothConnection) {
        if (this.isS3Profile()) {
            return this.authenticateS3(bluetoothConnection);
        }
        const nonce = await this.getSecurityChallenge(bluetoothConnection);
        console.log('Start authenticate');
        const passcode = this.cryptService.getPasscode();
        const command = new Uint8Array([1]);
        const paddLength = 16 - ((nonce.length + command.length + passcode.length) % 16);
        const data = new Uint8Array([
            ...nonce,
            ...command,
            ...passcode,
            ...new Uint8Array(paddLength),
        ]);
        console.log('data non encrypted', data);
        const dataencrypt = this.cryptService.encrypt(data);
        console.log('data encrypted', dataencrypt);
        const genericAccessService = await bluetoothConnection.getService('8e7f1a50087a44c9b292a2c628fdd9aa');
        await genericAccessService.write('8e7f1a53087a44c9b292a2c628fdd9aa', dataencrypt);
    }
    async makeEncryptedPayload(bluetoothConnection, data) {
        console.log('make encrypted payload');
        const nonce = await this.getSecurityChallenge(bluetoothConnection);
        const command = new Uint8Array([1]);
        const paddLength = 16 - ((nonce.length + command.length + data.length) % 16);
        const dataToEncrypt = new Uint8Array([
            ...nonce,
            ...command,
            ...data,
            ...new Uint8Array(paddLength),
        ]);
        console.log('to be encrypted payload', dataToEncrypt);
        return this.cryptService.encrypt(dataToEncrypt);
    }
    async readFromBike(bluetoothConnection, service, characteristic) {
        console.log('read from bike');
        this.ensureConnection(bluetoothConnection);
        try {
            const genericAccessService = await bluetoothConnection.getService(service);
            const data = await genericAccessService.read(characteristic);
            const uint8Array = new Uint8Array(data);
            //console.log(`Read ${uint8Array} from ${service} - ${characteristic}`)
            return uint8Array;
        }
        catch (error) {
            console.log(`Failed to read from ${service} - ${characteristic}`, error);
            throw error;
        }
    }
    async writeToBike(bluetoothConnection, payload, service, characteristic, writeWithoutEncryption = false) {
        this.ensureConnection(bluetoothConnection);
        try {
            const genericAccessService = await bluetoothConnection.getService(service);
            if (!writeWithoutEncryption) {
                const data = await this.makeEncryptedPayload(bluetoothConnection, payload);
                await genericAccessService.write(characteristic, data);
                console.log(`Wrote with encryption ${data} to ${service} - ${characteristic}`);
            }
            else {
                await genericAccessService.write(characteristic, payload);
                console.log(`Wrote without encryption ${payload} to ${service} - ${characteristic}`);
            }
        }
        catch (error) {
            console.log(`Failed to write to ${service} - ${characteristic}`, error);
            throw error;
        }
    }
    async getSecurityChallenge(bluetoothConnection) {
        if (this.isS3Profile()) {
            const nonce = await this.readFromBike(bluetoothConnection, '6acc5500-e631-4069-944d-b8ca7598ad50', '6acc5501-e631-4069-944d-b8ca7598ad50');
            console.log('Nonce S3 Security challenge', nonce);
            return nonce;
        }
        console.log('Get Security challenge');
        const nonce = await this.readFromBike(bluetoothConnection, '8e7f1a50087a44c9b292a2c628fdd9aa', '8e7f1a51087a44c9b292a2c628fdd9aa');
        console.log('Nonce Security challenge', nonce);
        return nonce;
    }
    async getIdentifier(bluetoothConnection) {
        const Identifier = await this.readFromBike(bluetoothConnection, 'f000ffc004514000b000000000000000', 'f000ffc404514000b000000000000000');
        const IdentifierDecrypt = this.cryptService.decrypt(Identifier);
        console.log('Identifiercdecrypt custom', IdentifierDecrypt);
        console.log('Identifier custom', Identifier);
        // return functions;
    }
    async getFunctions(bluetoothConnection) {
        const functions = await this.readFromBike(bluetoothConnection, '8e7f1a50087a44c9b292a2c628fdd9aa', '8e7f1a52087a44c9b292a2c628fdd9aa');
        const functionsDecrypt = this.cryptService.decrypt(functions);
        console.log('Functionsdecrypt', functionsDecrypt);
        console.log('Functions', functions);
        // return functions;
    }
    async getParameters(bluetoothConnection) {
        if (this.isS3Profile()) {
            return this.getS3Parameters(bluetoothConnection);
        }
        const parameters = await this.readFromBike(bluetoothConnection, '8e7f1a50087a44c9b292a2c628fdd9aa', '8e7f1a54087a44c9b292a2c628fdd9aa');
        const parametersDecrypt = this.cryptService.decrypt(parameters);
        console.log('Parameterscdecrypt', parametersDecrypt);
        console.log('Parameters', parameters);
        if (this.isS2Profile()) {
            return this.getS2CompatibilityParameters(parametersDecrypt);
        }
        return parametersDecrypt;
    }
    isS2Profile() {
        return this.bikeProfile === 'S2' ||
            this.bikeProfile === 'ELECTRIFIED_2018' ||
            this.bikeProfile === 'ELECTRIFIED_2019';
    }
    isS3Profile() {
        return this.bikeProfile === 'S3' || this.bikeProfile === 'ELECTRIFIED_2020';
    }
    getS2CompatibilityParameters(parametersData) {
        const parameters = Array.from(parametersData);
        const trackingState = (parametersData[2] & 16) >> 4;
        const sleepingState = (parametersData[2] & 32) >> 5;
        if ((parametersData[2] & 1) === 1) {
            parameters[2] = 0; // ON
        }
        else if (trackingState === 1) {
            parameters[2] = 8; // TRACKING
        }
        else if (sleepingState === 1) {
            parameters[2] = 7; // SLEEPING
        }
        else {
            parameters[2] = 3; // STANDBY
        }
        parameters[7] = parametersData[7] & 3;
        parameters[8] = parametersData[8];
        parameters[9] = (parametersData[8] & 3) + 1;
        return parameters;
    }
    async authenticateS3(bluetoothConnection) {
        if (this.userKeyId === undefined || this.userKeyId === null) {
            throw new Error('Missing user key id for S3 authentication');
        }
        const nonce = await this.getSecurityChallenge(bluetoothConnection);
        const data = new Uint8Array(16);
        data.set(nonce.slice(0, 2), 0);
        const encryptedNonce = this.cryptService.encrypt(data);
        const authenticationPayload = new Uint8Array(20);
        authenticationPayload.set(encryptedNonce, 0);
        authenticationPayload.set([0, 0, 0, this.userKeyId], 16);
        const genericAccessService = await bluetoothConnection.getService('6acc5500-e631-4069-944d-b8ca7598ad50');
        await genericAccessService.write('6acc5502-e631-4069-944d-b8ca7598ad50', authenticationPayload);
    }
    async readEncryptedS3Value(bluetoothConnection, service, characteristic) {
        const encryptedValue = await this.readFromBike(bluetoothConnection, service, characteristic);
        return this.cryptService.decrypt(encryptedValue);
    }
    async getS3Parameters(bluetoothConnection) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        await this.authenticateS3(bluetoothConnection);
        const parameters = new Array(16).fill(0);
        const [motorBatteryLevel, moduleBatteryLevel, moduleState, lockState, distance, lightMode, powerLevel, speedLimit, errors, motorBatteryState,] = await Promise.all([
            this.readEncryptedS3Value(bluetoothConnection, '6acc5540-e631-4069-944d-b8ca7598ad50', '6acc5541-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5540-e631-4069-944d-b8ca7598ad50', '6acc5543-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5560-e631-4069-944d-b8ca7598ad50', '6acc5562-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5520-e631-4069-944d-b8ca7598ad50', '6acc5521-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5530-e631-4069-944d-b8ca7598ad50', '6acc5531-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5580-e631-4069-944d-b8ca7598ad50', '6acc5581-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5530-e631-4069-944d-b8ca7598ad50', '6acc5534-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5530-e631-4069-944d-b8ca7598ad50', '6acc5535-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5560-e631-4069-944d-b8ca7598ad50', '6acc5563-e631-4069-944d-b8ca7598ad50'),
            this.readEncryptedS3Value(bluetoothConnection, '6acc5540-e631-4069-944d-b8ca7598ad50', '6acc5542-e631-4069-944d-b8ca7598ad50'),
        ]);
        parameters[2] = (_a = moduleState[0]) !== null && _a !== void 0 ? _a : 0;
        parameters[3] = (_b = lockState[0]) !== null && _b !== void 0 ? _b : 0;
        parameters[5] = (_c = motorBatteryLevel[0]) !== null && _c !== void 0 ? _c : 0;
        parameters[6] = (_d = moduleBatteryLevel[0]) !== null && _d !== void 0 ? _d : 0;
        parameters[7] = (_e = lightMode[0]) !== null && _e !== void 0 ? _e : 0;
        parameters[8] = (_f = powerLevel[0]) !== null && _f !== void 0 ? _f : 0;
        parameters[9] = (_g = speedLimit[0]) !== null && _g !== void 0 ? _g : 0;
        parameters[11] = (_h = distance[0]) !== null && _h !== void 0 ? _h : 0;
        parameters[12] = (_j = distance[1]) !== null && _j !== void 0 ? _j : 0;
        parameters[13] = (_k = distance[2]) !== null && _k !== void 0 ? _k : 0;
        parameters[14] = (_l = distance[3]) !== null && _l !== void 0 ? _l : 0;
        parameters[15] = (((_m = errors[0]) !== null && _m !== void 0 ? _m : 0) << 3) | (motorBatteryState[0] === 1 ? 1 : 0);
        return parameters;
    }
    ensureConnection(bluetoothConnection) {
        if (!bluetoothConnection) {
            throw new Error('Bluetooth connection not available');
        }
        if (typeof bluetoothConnection.getService !== 'function') {
            throw new Error('Bluetooth connection object is invalid');
        }
    }
}
exports.default = vanmoofbike;
//# sourceMappingURL=vanmoofbike.js.map