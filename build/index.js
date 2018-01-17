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
      return [this.infoService, this.switchService];
    };

    this.getState = cb => {
      // TODO: HTTP state
      let value = Characteristic.CurrentDoorState.STOPPED;
      switch (this.state) {
        case "open":
          value = Characteristic.CurrentDoorState.OPEN;
          break;
        case "closed":
          value = Characteristic.CurrentDoorState.CLOSED;
          break;
        case "unknown":
          value = Characteristic.CurrentDoorState.STOPPED;
          break;
        default:
          this.log("Current state is weird!", this.state);
          break;
      }

      cb(null, value);
      return;

      /*
      if (this.lastChecked && this.lastChecked > (Date.now() - this.checkInterval)) {
        this.log.debug("Using cached power state");
        return cb(null, this.lastState);
      }
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

    this.setState = (targetState, cb) => {
      this.log("SetState target state", targetState);
      switch (targetState) {
        case Characteristic.TargetDoorState.OPEN:
          this.state = "open";
          break;
        case Characteristic.TargetDoorState.CLOSED:
          this.state = "closed";
          break;
        default:
          this.log("UNKNOWN TARGET STATE");
          break;
      }
      cb();
      return;
      // There's a weird interaction (pair of bugs) where this fetch wrapper
      // lowercases all of the HTTP header keys, and the ESP8266WebServer library
      // won't parse the POST body unless the Content-Length header is formatted
      // exactly as such. Fortunately, throwing the value in the query string
      // allows it to go through just fine.
      /*
      const state = on ? "on" : "off";
      fetch(this.host + '/power?state=' + state, { method: "POST" })
        .then(_ => {
          this.lastState = on;
          this.lastChecked = Date.now();
          cb();
        })
        */
    };

    if (!config) {
      log('Ignoring screen - no config');
      return;
    }
    this.log = log;

    const { host } = config;
    this.host = host;

    this.state = "unknown";

    /*
    // State caching variables: when the projector is changing state, it
    // reports the _current_ rather than the _target_ state. This will cache
    // the last known state (either from polling or toggling it) for 15s
    this.lastState = null
    this.lastChecked = null
    this.checkInterval = 15000; // milliseconds
    */

    [this.infoService, this.doorService] = this.createServices();
  }

}