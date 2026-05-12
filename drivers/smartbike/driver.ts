import { Driver } from 'homey';
import vanmoofweb from '../../lib/vanmoofweb';


class vanMoofSmart extends Driver {
  private vanmoofweb: vanmoofweb = new vanmoofweb(this);
  private currentSettings: { username?: string; password?: string; authToken?: string; apiKey?: string} = {};

async onInit() {
  this.log('Vanmoof SmartDriver has been initialized');
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
  } catch (error) {
    this.error(`Wrong username or Password: ${error}`);
    throw error;
  }
}


  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */



  async onPairListDevices() {
    this.log('Onpairlistdevices');
    const apiKey = 'fcb38d47-f14b-30cf-843b-26283f6a5819';
  
    try {
      if (!this.currentSettings.authToken || !this.currentSettings.apiKey) {
        this.error('authToken or apiKey not set in currentSettings.');
        return []; // Return empty array if auth data is missing.
      }
  
      const bikes = await this.vanmoofweb.getBikesDetails(
        this.currentSettings.authToken,
        this.currentSettings.apiKey,
      );
  
      const devicesToPresent = [];
  
      for (const bike of bikes.data.bikeDetails) {
        if (
          bike.bleProfile === 'ELECTRIFIED_2017' ||
          bike.bleProfile === 'SMARTBIKE_2016'
        ) {
          devicesToPresent.push({
            name: bike.name,
            data: {
              id: bike.id,
              name: bike.name,
              frameNumber: bike.frameNumber,
              uuid: bike.macAddress.replaceAll(':', '').toLowerCase(),
            },
            store: {
              encryptionKey: bike.key.encryptionKey,
              passcode: bike.key.passcode,
              userKeyId: bike.key.userKeyId,
            },
          });
        } else {
          this.log(`Skipping bike ${bike.name} with bleProfile: ${bike.bleProfile}`);
        }
      }
  
      return devicesToPresent;
    } catch (error) {
      this.error('Error getting bikes details:', error);
      return []; // Return empty array on error.
    }
  }
}

module.exports = vanMoofSmart;