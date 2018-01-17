/*
 * Expected config:
 *
 * {
 *   "platform": "ProjectorScreen",
 *   "host": "projector-screen.local",
 * }
 */
var Accessory, Characteristic, Service, UUIDGen;

const platformName = 'homebridge-plugin-projector-screen';
const platformPrettyName = 'ProjectorScreen';
const fetch = require('node-fetch');

module.exports = homebridge => {
  Accessory = homebridge.platformAccessory;
  Characteristic = homebridge.hap.Characteristic;
  Service = homebridge.hap.Service;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerAccessory(platformName, platformPrettyName, Screen, true);
};

const TRAVEL_DURATION_SEC = 5; // for debugging; actually 30;

class Screen {

  // These values are provided via Homebridge
  constructor(log, config) {
    this.createServices = () => {
      const infoService = new Service.AccessoryInformation();
      infoService.setCharacteristic(Characteristic.Manufacturer, 'Favi').setCharacteristic(Characteristic.Model, 'Some Screen').setCharacteristic(Characteristic.SerialNumber, 'Some SN');

      const doorService = new Service.GarageDoorOpener(this.name);
      doorService.getCharacteristic(Characteristic.CurrentDoorState).on('get', this.getState);
      doorService.getCharacteristic(Characteristic.TargetDoorState).on('set', this.setState);
      doorService.setCharacteristic(Characteristic.ObstructionDetected, false);

      return [infoService, doorService];
    };

    this.getServices = () => {
      return [this.infoService, this.doorService];
    };

    this.getState = cb => {
      const value = this.getHomekitState();
      this.log("GetState returning ", value);
      cb(null, value);
    };

    this.getHomekitState = () => {
      // TODO: HTTP state
      let value = Characteristic.CurrentDoorState.STOPPED;
      switch (this.state) {
        case "open":
          value = Characteristic.CurrentDoorState.OPEN;
          break;
        case "opening":
          value = Characteristic.CurrentDoorState.OPENING;
          break;
        case "closed":
          value = Characteristic.CurrentDoorState.CLOSED;
          break;
        case "closing":
          value = Characteristic.CurrentDoorState.CLOSING;
          break;
        case "unknown":
          value = Characteristic.CurrentDoorState.STOPPED;
          break;
        default:
          this.log("Current state is weird!", this.state);
          break;
      }
      return value;
      /*
      fetch(this.host + '/')
        .then(res => {
          if (!res.ok) {
            throw new Error(res.status + ' ' + res.statusText);
          }
          return res;
        })
        .then(res => res.text())
        .then(text => text.match(/OK([01])/)[1])
        .then(statusText => {
          const powerState = (statusText === "1");
          this.lastState = powerState;
          this.lastChecked = Date.now();
          cb(null, powerState);
        });
        */
    };

    this.pushCurrentState = () => {
      this.log("Pushing out current door state");
      this.doorService.setCharacteristic(Characteristic.CurrentDoorState, this.getHomekitState());
    };

    this.setState = (targetState, cb) => {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

      this.log("SetState target state", targetState);
      switch (targetState) {
        case Characteristic.TargetDoorState.OPEN:
          this.state = "opening";
          this.targetState = "open";
          break;
        case Characteristic.TargetDoorState.CLOSED:
          this.state = "closing";
          this.targetState = "closed";
          break;
        default:
          this.log("UNKNOWN TARGET STATE");
          break;
      }

      this.log("Set state to ", this.state);
      this.timeout = setTimeout(() => {
        this.state = this.targetState;
        this.pushCurrentState();
        this.timeout = null;
      }, TRAVEL_DURATION_SEC * 1000);

      const direction = this.targetState === "open" ? "down" : "up";

      const url = this.host + '/' + direction;

      this.log('POST' + url);

      fetch(url, { method: "POST" }).then(_ => {
        cb();
      });
    };

    if (!config) {
      log('Ignoring screen - no config');
      return;
    }
    this.log = log;

    const { host } = config;
    this.host = host;

    this.state = "unknown";
    this.targetState = null;
    this.timeout = null;

    [this.infoService, this.doorService] = this.createServices();
  }

}