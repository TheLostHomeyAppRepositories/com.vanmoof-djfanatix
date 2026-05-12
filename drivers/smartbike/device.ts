import { Device, SimpleClass } from 'homey';
import vanmoofbike from '../../lib/vanmoofbike';
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);



class vanMoofSmart extends Device {
  private vanmoofBikeInstance: any; // Store vanmoofbike instance
  private intervalId: any; // Store interval ID
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('Vanmoof SmartBike has been initialized');
    const store = this.getStore();

    if (!store || !store.encryptionKey) {
      this.error("Missing store properties, user key id");
      return;
    }

    this.vanmoofBikeInstance = new vanmoofbike('S1', store.encryptionKey);
    let settingsinterval = this.getSettings().interval;

    const scan_interval = settingsinterval * 60 * 1000; // x minutes

    this.log('interval', settingsinterval);

    try {
      this.intervalId = this.homey.setInterval(async () => {
        await this.scan();
      }, scan_interval);
    } catch (error) {
      this.error("error setting interval", error);
    }
    this.scan(); // Initial scan
  }


  
    // Get the Device ID
   
    async scan() {

    const store = this.getStore()
    this.log('store',store)
    const bike = new vanmoofbike('Smartbike_2016', store.encryptionKey)
    this.log('bike', bike)

    const data = this.getData()
    const deviceId = data.uuid
    this.log('deviceId', deviceId)
    // Attempt a connection
    this.log(`Trying to connect to smartbike with ID ${deviceId}`)
    const bikeConnection = await this.connectToBike(deviceId)
    if (bikeConnection) {

     // const authenticate = await bike.authenticate(bikeConnection)
      const parameters = await bike.getParameters(bikeConnection)
      const challenge = await bike.getSecurityChallenge(bikeConnection)
      const identifier = await bike.getIdentifier(bikeConnection)
      const functions = await bike.getFunctions(bikeConnection)
      this.log('Parametersdevice', parameters)
      // Distance
      const distance = parameters[11] + (parameters[12] << 8) + (parameters[13] << 16) + (parameters[14] << 24);
      const distance1 = distance / 10;
      //this.log('distance', distance1);
      this.setCapabilityValue('distance', distance1);

      //Module Battery
      const modulelevel = parameters[6]
      this.log('modulelevel', modulelevel);
      this.setCapabilityValue('measure_module', modulelevel);
      // Module State
      const modulestate = parameters[2]
      if (modulestate == 0) {
        this.setCapabilityValue('modulestate', ('ON'));
      } else if (modulestate == 1) {
        this.setCapabilityValue('modulestate', ('OFF'));
      } else if (modulestate == 2) {
        this.setCapabilityValue('modulestate', ('SHIPPING'));
      } else if (modulestate == 3) {
        this.setCapabilityValue('modulestate', ('STANDBY'));
      } else if (modulestate == 4) {
        this.setCapabilityValue('modulestate', ('ALARM ONE'));
      } else if (modulestate == 5) {
        this.setCapabilityValue('modulestate', ('ALARM TWO'));
      } else if (modulestate == 6) {
        this.setCapabilityValue('modulestate', ('ALARM THREE'));
      } else if (modulestate == 7) {
        this.setCapabilityValue('modulestate', ('SLEEPING'));    
      } else if (modulestate == 8) {
        this.setCapabilityValue('modulestate', ('TRACKING'));   
      } 
      //this.log('modulestate', modulestate);
      // Lock state
      const lockstate = parameters[3]
      if (lockstate == 0) {
        this.setCapabilityValue('lockstate', ('UNLOCKED'));
      } else if (lockstate == 1) {
        this.setCapabilityValue('lockstate', ('LOCKED'));
      } 
      // Lights
      const lightlevel = parameters[7]
      if (lightlevel == 0) {
        this.setCapabilityValue('lights', ('AUTO'));
      } else if (lightlevel == 1) {
        this.setCapabilityValue('lights', ('ON'));
      } else if (lightlevel == 2) {
        this.setCapabilityValue('lights', ('OFF'));
      } else if (lightlevel == 3) {
        this.setCapabilityValue('lights', ('REAR FLASH'));
      } else if (lightlevel == 4) {
        this.setCapabilityValue('lights', ('REAR FLASH OFF'));
      } 
      //this.log('Ligh Level', lightlevel);
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
      this.setCapabilityValue('error', errorMessage);

    //Last Poll
    var timezone = this.homey.clock.getTimezone();
    var today = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }))
    const hours = String(today.getHours()).padStart(2, '0');
    const minutes = String(today.getMinutes()).padStart(2, '0');
    const currentTime = `${hours}:${minutes}`;
    this.log('Time now', currentTime)
    this.setCapabilityValue('lastpoll', currentTime);
    this.setCapabilityValue('alarm_generic', false); 

    /*
      //Charging
      const batterycharging = (parameters[15] & 1)
     // this.log('batterycharging', batterycharging);
      if (batterycharging == 0) {
        this.setCapabilityValue('batterycharging', ('OFF'));
      } else if (batterycharging == 1) {
        this.setCapabilityValue('batterycharging', ('CHARGING'));
      }
        */
    } else {
      //this.log('Could not connect to bike scan');
      this.setCapabilityValue('alarm_generic', true); 
      //this.restartDevice()
      this.log('Could not connect to bike scan')
      //this.setUnavailable('Could not connect to bike unavailable')
    }
  }



  async connectToBike (deviceID: string) {
    try {
      const advertisement = await this.homey.ble.find(deviceID)
 
      
      const bikeConnection = await advertisement.connect()
      if (bikeConnection) {
        this.log('Connected to smartbike')
        return bikeConnection
      } else {
        this.log('Could not connect to bike connecttoBike')
        //const bikeDisConnection = await bikeConnection.disconnect();
        this.setCapabilityValue('alarm_generic', true); 
        //this.restartDevice()
        //throw new Error('Could not connect to bike after connect to bike')
        
      }
    }
    catch (error) {
      this.log(error);
    }
  }

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

module.exports = vanMoofSmart;


