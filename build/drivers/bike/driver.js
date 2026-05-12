"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const homey_1 = require("homey");
const vanmoofweb_1 = __importDefault(require("../../lib/vanmoofweb"));
class vanMoof extends homey_1.Driver {
    constructor() {
        super(...arguments);
        this.vanmoofweb = new vanmoofweb_1.default(this);
        this.currentSettings = {};
    }
    async onInit() {
        this.log('Vanmoof Driver has been initialized');
        this.currentSettings = {
            username: this.homey.settings.get('username'),
            password: this.homey.settings.get('password'),
            authToken: this.homey.settings.get('authToken'),
            apiKey: this.homey.settings.get('apiKey'),
        };
        await this.getVanmoofApi();
    }
    async getVanmoofApi() {
        const apiKey = 'fcb38d47-f14b-30cf-843b-26283f6a5819';
        const username = this.homey.settings.get('username');
        const password = this.homey.settings.get('password');
        this.log('getVanmoofApi called');
        if (!username || !password) {
            this.error('Username or Password not set, please set them in the app settings page.');
            return;
        }
        try {
            const authToken = await this.vanmoofweb.getAuthToken(apiKey, username, password);
            this.homey.settings.set('authToken', authToken);
            this.homey.settings.set('apiKey', apiKey);
            this.currentSettings.authToken = authToken;
            this.currentSettings.apiKey = apiKey;
            this.log('apiKey', apiKey);
            this.log('authToken', authToken);
            this.log("getVanmoofApi success");
        }
        catch (error) {
            this.error(`Wrong username or Password: ${error}`);
            throw error;
        }
    }
    /**
     * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
     * This should return an array with the data of devices that are available for pairing.
     */
    async onPairListDevices() {
        var _a, _b, _c, _d;
        this.log('Onpairlistdevices');
        const apiKey = 'fcb38d47-f14b-30cf-843b-26283f6a5819';
        try {
            if (!this.currentSettings.authToken || !this.currentSettings.apiKey) {
                this.error('authToken or apiKey not set in currentSettings.');
                return []; // Return empty array if auth data is missing.
            }
            const bikes = await this.vanmoofweb.getBikesDetails(this.currentSettings.authToken, this.currentSettings.apiKey);
            const devicesToPresent = [];
            for (const bike of bikes.data.bikeDetails) {
                if (bike.bleProfile === 'ELECTRIFIED_2020' ||
                    bike.bleProfile === 'ELECTRIFIED_2019' ||
                    bike.bleProfile === 'ELECTRIFIED_2018' ||
                    bike.bleProfile === 'ELECTRIFIED_2017' ||
                    bike.bleProfile === 'ELECTRIFIED_2016' ||
                    ((_a = bike.modelDetails) === null || _a === void 0 ? void 0 : _a.Edition) === 'S2' ||
                    ((_b = bike.modelDetails) === null || _b === void 0 ? void 0 : _b.Edition) === 'X2') {
                    devicesToPresent.push({
                        name: bike.name,
                        data: {
                            id: bike.id,
                            name: bike.name,
                            frameNumber: bike.frameNumber,
                            uuid: bike.macAddress.replaceAll(':', '').toLowerCase(),
                            bleProfile: bike.bleProfile,
                            bikeModel: (_c = bike.modelDetails) === null || _c === void 0 ? void 0 : _c.Edition,
                        },
                        store: {
                            encryptionKey: bike.key.encryptionKey,
                            passcode: bike.key.passcode,
                            userKeyId: bike.key.userKeyId,
                            bleProfile: bike.bleProfile,
                            bikeModel: (_d = bike.modelDetails) === null || _d === void 0 ? void 0 : _d.Edition,
                        },
                    });
                }
                else {
                    this.log(`Skipping bike ${bike.name} with bleProfile: ${bike.bleProfile}`);
                }
            }
            return devicesToPresent;
        }
        catch (error) {
            this.error('Error getting bikes details:', error);
            return []; // Return empty array on error.
        }
    }
}
module.exports = vanMoof;
//# sourceMappingURL=driver.js.map