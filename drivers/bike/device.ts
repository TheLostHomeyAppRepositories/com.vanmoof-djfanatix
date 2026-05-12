import { Device, SimpleClass } from 'homey';
import vanmoofbike from '../../lib/vanmoofbike';
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);



class vanMoof extends Device {
  private vanmoofBikeInstance: any; // Store vanmoofbike instance
  private intervalId: any; // Store interval ID
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Vanmoof Bike has been initialized');
    const store = this.getStore();

    this.addCapability('error')

    if (!store || !store.encryptionKey) {
      this.error("Missing store properties, user key id");
      return;
    }

    this.vanmoofBikeInstance = new vanmoofbike(this.getBikeProfile(), store.encryptionKey, store.userKeyId);
    let settingsinterval = this.getSettings().interval;

    const scan_interval = settingsinterval * 60 * 1000; // x minutes

    this.log('interval', settingsinterval);

    try {
      this.intervalId = this.homey.setInterval(async () => {
        try {
          await this.scan();
        } catch (error) {
          await this.handleScanError(error, 'Recurring scan failed');
        }
      }, scan_interval);
    } catch (error) {
      this.error("error setting interval", error);
    }

    try {
      await this.scan(); // Initial scan
    } catch (error) {
      await this.handleScanError(error, 'Initial scan failed');
    }
  }

  private async handleScanError(error: any, context: string) {
    this.error(context, error);
    try {
      await this.setCapabilityValue('alarm_generic', true);
    } catch (capError) {
      this.log('Failed to update alarm_generic capability', capError);
    }
  }


  
    // Get the Device ID
   
    async scan() {

  //DELETE  //const deviceId = this.homey.settings.get('deviceId');
    const store = this.getStore()
    this.log('store',store)
    const bike = new vanmoofbike(this.getBikeProfile(), store.encryptionKey, store.userKeyId)
    this.log('bike', bike)
/*
    // Check if the deviceid is known (This is not the same as we get from Vanmoof)
    const knownDeviceId = await this.detirminDeviceId()
    if (!knownDeviceId) {
      this.setUnavailable('Cannot find device ID of the bike, bring closer to Homey and try again')
    } else {
      // Get the Device ID
      const deviceId = this.getStoreValue("deviceId");
    }
*/
    const data = this.getData()
    const deviceId = data.uuid
    this.log('deviceId', deviceId)
    // Attempt a connection
    this.log(`Trying to connect to bike with ID ${deviceId}`)
    let bikeConnection;
    try {
      bikeConnection = await this.connectToBike(deviceId)
    } catch (error) {
      await this.handleScanError(error, 'Could not connect to bike during scan');
      return;
    }
    if (!bikeConnection) {
      await this.handleScanError(new Error('No bike connection available'), 'Could not connect to bike scan');
      return;
    }

    try {
     // const authenticate = await bike.authenticate(bikeConnection)
      const parameters = await bike.getParameters(bikeConnection)
    
      //this.log('battery level', parameters)
      // Distance
      const distance = parameters[11] + (parameters[12] << 8) + (parameters[13] << 16) + (parameters[14] << 24);
      const distance1 = distance / 10;
      //this.log('distance', distance1);
      await this.setCapabilityValue('distance', distance1);

      // Battery  
      const batterylevel = parameters[5]
      this.log('battery', batterylevel);
      await this.setCapabilityValue('measure_battery', batterylevel);
      //Module Battery
      const modulelevel = parameters[6]
      this.log('modulelevel', modulelevel);
      await this.setCapabilityValue('measure_module', modulelevel);
      // Module State
      const modulestate = parameters[2]
      if (modulestate == 0) {
        await this.setCapabilityValue('modulestate', ('ON'));
      } else if (modulestate == 1) {
        await this.setCapabilityValue('modulestate', ('OFF'));
      } else if (modulestate == 2) {
        await this.setCapabilityValue('modulestate', ('SHIPPING'));
      } else if (modulestate == 3) {
        await this.setCapabilityValue('modulestate', ('STANDBY'));
      } else if (modulestate == 4) {
        await this.setCapabilityValue('modulestate', ('ALARM ONE'));
      } else if (modulestate == 5) {
        await this.setCapabilityValue('modulestate', ('ALARM TWO'));
      } else if (modulestate == 6) {
        await this.setCapabilityValue('modulestate', ('ALARM THREE'));
      } else if (modulestate == 7) {
        await this.setCapabilityValue('modulestate', ('SLEEPING'));    
      } else if (modulestate == 8) {
        await this.setCapabilityValue('modulestate', ('TRACKING'));   
      } 
      //this.log('modulestate', modulestate);
      // Lock state
      const lockstate = parameters[3]
      if (lockstate == 0) {
        await this.setCapabilityValue('lockstate', ('UNLOCKED'));
      } else if (lockstate == 1) {
        await this.setCapabilityValue('lockstate', ('LOCKED'));
      } 
       // Region
       const region = parameters[9]
       if (region == 0) {
         await this.setCapabilityValue('region', ('UNSUPPORTED'));
       } else if (region == 1) {
         await this.setCapabilityValue('region', ('EU'));
       } else if (region == 2) {
         await this.setCapabilityValue('region', ('US'));
       } else if (region == 3) {
         await this.setCapabilityValue('region', ('OFFROAD'));
       } else if (region == 4) {
         await this.setCapabilityValue('region', ('JAPAN'));
       } 
      // Lights
      const lightlevel = parameters[7]
      if (lightlevel == 0) {
        await this.setCapabilityValue('lights', ('AUTO'));
      } else if (lightlevel == 1) {
        await this.setCapabilityValue('lights', ('ON'));
      } else if (lightlevel == 2) {
        await this.setCapabilityValue('lights', ('OFF'));
      } else if (lightlevel == 3) {
        await this.setCapabilityValue('lights', ('REAR FLASH'));
      } else if (lightlevel == 4) {
        await this.setCapabilityValue('lights', ('REAR FLASH OFF'));
      } 
      //this.log('Ligh Level', lightlevel);
      // Power level
      const powerlevel = parameters[8]
      await this.setCapabilityValue('powerlevel', powerlevel);
      //this.log('Power Level', powerlevel);
    // Haal de errorcode uit parameters[15]
      const error = (parameters[15] & 248) >> 3;
      let errorMessage: string;

      // Mapping van errorcodes naar foutmeldingen
      if (error === 0) {
        errorMessage = 'No Error';
      } else if (error === 1) {
        errorMessage = 'Motor Stalled';
      } else if (error === 2) {
        errorMessage = 'Over Voltage';
      } else if (error === 3) {
        errorMessage = 'Under Voltage';
      } else if (error === 5) {
        errorMessage = 'Motor Fast';
      } else if (error === 6) {
        errorMessage = 'Over Current';
      } else if (error === 7) {
        errorMessage = 'Torque Abnormal';
      } else if (error === 8) {
        errorMessage = 'Torque Initial Abnormal';
      } else if (error === 9) {
        errorMessage = 'Over Temperature';
      } else if (error === 16) {
        errorMessage = 'Hall Arrangement Mismatch';
      } else if (error === 25) {
        errorMessage = 'I2C Bus Error';
      } else if (error === 26) {
        errorMessage = 'GSM UART Timeout';
      } else if (error === 27) {
        errorMessage = 'Controller UART Timeout';
      } else if (error === 28) {
        errorMessage = 'GSM Registration Failure';
      } else if (error === 29) {
        errorMessage = 'No Battery Output';
      } else {
        errorMessage = 'Unknown Error';
      }

      // Log de errorcode en de foutmelding
      this.log('Error Code', error);
      this.log('Error Message', errorMessage);

      // Set de capability voor error in Homey
      await this.setCapabilityValue('error', errorMessage);


    //Last Poll
    var timezone = this.homey.clock.getTimezone();
    var today = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }))
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    this.log('Time now', currentTime)
    await this.setCapabilityValue('lastpoll', currentTime);
    await this.setCapabilityValue('alarm_generic', false); 

      //Charging
      const batterycharging = (parameters[15] & 1)
     // this.log('batterycharging', batterycharging);
      if (batterycharging == 0) {
        await this.setCapabilityValue('batterycharging', ('OFF'));
      } else if (batterycharging == 1) {
        await this.setCapabilityValue('batterycharging', ('CHARGING'));
      }
    } catch (error) {
      await this.handleScanError(error, 'Failed to retrieve bike parameters');
    } finally {
      try {
        await bikeConnection.disconnect();
      } catch (error) {
        this.log('Error disconnecting from bike', error);
      }
    }
  }

  private getBikeProfile() {
    const store = this.getStore();
    const data = this.getData();
    if (store?.bleProfile === 'ELECTRIFIED_2020' || data?.bleProfile === 'ELECTRIFIED_2020') {
      return 'S3';
    }
    if (
      store?.bleProfile === 'ELECTRIFIED_2019' ||
      data?.bleProfile === 'ELECTRIFIED_2019' ||
      store?.bleProfile === 'ELECTRIFIED_2018' ||
      data?.bleProfile === 'ELECTRIFIED_2018' ||
      store?.bikeModel === 'S2' ||
      data?.bikeModel === 'S2' ||
      store?.bikeModel === 'X2' ||
      data?.bikeModel === 'X2'
    ) {
      return 'S2';
    }
    return 'S1';
  }



  async connectToBike (deviceID: string) {
    try {
      const advertisement = await this.homey.ble.find(deviceID)

 
      const bikeConnection = await advertisement.connect()
      if (bikeConnection) {
        this.log('Connected to bike')
        return bikeConnection
      } else {
        this.log('Could not connect to bike connecttoBike')
        await this.setCapabilityValue('alarm_generic', true); 
        throw new Error('Could not connect to bike after advertisement connect');
      }
    }
    catch (error) {
      this.log(error);
      throw error;
    }
  }

  //DELETE
/*
  async detirminDeviceId () {
    try {
      this.log('detirmindeviceID')
      const data = this.getData()
      const settings = this.getSettings();
      this.log('data',data)
      this.log('settings',settings)
      const advertisements = await this.homey.ble.discover();
      const filteredAdvertisements = advertisements.filter(advertisement =>
        advertisement.localName?.endsWith(data.uuid.toUpperCase())
      );
      if (settings.deviceId === undefined) {
        if (filteredAdvertisements.length === 0) {
          this.log('No device ID found')
          return false
        } else {
          this.log(`Found device ID - ${filteredAdvertisements[0].id}`)
          this.homey.settings.set('deviceId', filteredAdvertisements[0].id);
          return true
        }
      } else {
        this.log(`Device ID already known as ${settings.deviceId}`) 
        return true
      }
    }
    catch (error) {
      this.log(error)
    }
  }
    */
  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('Vanmoof Bike has been added')
  //  const knownDeviceId = await this.detirminDeviceId()
  //  if (!knownDeviceId) {
  //    this.setUnavailable('Cannot find device ID onadded of the bike, bring closer to Homey and try again')
  //  }
  }

  async onSettings({ oldSettings: {}, newSettings: {}, changedKeys: {} }): Promise<string|void> {
    this.log('Vanmoof Bike settings where changed');
    this.restartDevice();
  }
  
  async restartDevice() {
		//const dly = 360000;
    const dly = 60000;
    this.homey.clearInterval(this.scan);
		this.log(`Device will restart in ${dly / 1000} seconds`);
		// this.setUnavailable('Device is restarting. Wait a few minutes!');  
		await setTimeoutPromise(dly).then(() => this.onInit());
	}

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('Vanmoof Bike was renamed');
  
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('Vanmoof has been deleted');
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
}
}

module.exports = vanMoof;
