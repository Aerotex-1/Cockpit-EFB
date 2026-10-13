/* Cockpit EFB Link 0.7.0 – enthält die EFB-API von Asobo Studio (MIT) */
var __defProp = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(() => {
  var __create = Object.create;
  var __getProtoOf = Object.getPrototypeOf;
  var __defProp2 = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp2 = Object.prototype.hasOwnProperty;
  function __accessProp(key) {
    return this[key];
  }
  var __toESMCache_node;
  var __toESMCache_esm;
  var __toESM = (mod, isNodeMode, target) => {
    var canCache = mod != null && typeof mod === "object";
    if (canCache) {
      var cache = isNodeMode ? __toESMCache_node != null ? __toESMCache_node : __toESMCache_node = /* @__PURE__ */ new WeakMap() : __toESMCache_esm != null ? __toESMCache_esm : __toESMCache_esm = /* @__PURE__ */ new WeakMap();
      var cached = cache.get(mod);
      if (cached)
        return cached;
    }
    target = mod != null ? __create(__getProtoOf(mod)) : {};
    const to = isNodeMode || !mod || !mod.__esModule || !__hasOwnProp2.call(mod, "default") ? __defProp2(target, "default", { value: mod, enumerable: true }) : target;
    if (mod && typeof mod === "object" || typeof mod === "function") {
      for (let key of __getOwnPropNames(mod))
        if (!__hasOwnProp2.call(to, key))
          __defProp2(to, key, {
            get: __accessProp.bind(mod, key),
            enumerable: true
          });
    }
    if (canCache)
      cache.set(mod, to);
    return to;
  };
  var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
  var require_msfs_sdk_shim = __commonJS(function(exports, module) {
    module.exports = typeof msfssdk !== "undefined" ? msfssdk : globalThis.msfssdk;
  });
  var import_msfs_sdk = __toESM(require_msfs_sdk_shim(), 1);
  var __defProp22 = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols2 = Object.getOwnPropertySymbols;
  var __hasOwnProp22 = Object.prototype.hasOwnProperty;
  var __propIsEnum2 = Object.prototype.propertyIsEnumerable;
  var __defNormalProp2 = (obj, key, value2) => key in obj ? __defProp22(obj, key, { enumerable: true, configurable: true, writable: true, value: value2 }) : obj[key] = value2;
  var __spreadValues2 = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp22.call(b, prop))
        __defNormalProp2(a, prop, b[prop]);
    if (__getOwnPropSymbols2)
      for (var prop of __getOwnPropSymbols2(b)) {
        if (__propIsEnum2.call(b, prop))
          __defNormalProp2(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var AppBootMode = /* @__PURE__ */ ((AppBootMode2) => {
    AppBootMode2[AppBootMode2["COLD"] = 0] = "COLD";
    AppBootMode2[AppBootMode2["WARM"] = 1] = "WARM";
    AppBootMode2[AppBootMode2["HOT"] = 2] = "HOT";
    return AppBootMode2;
  })(AppBootMode || {});
  var AppSuspendMode = /* @__PURE__ */ ((AppSuspendMode2) => {
    AppSuspendMode2[AppSuspendMode2["SLEEP"] = 0] = "SLEEP";
    AppSuspendMode2[AppSuspendMode2["TERMINATE"] = 1] = "TERMINATE";
    return AppSuspendMode2;
  })(AppSuspendMode || {});
  var uid = 0;
  class Container {
    constructor() {
      this._uid = uid++;
      this._registeredAppsPromises = [];
      this._installedApps = import_msfs_sdk.ArraySubject.create();
    }
    static get instance() {
      return window.EFB_API = Container._instance = window.EFB_API || Container._instance || new Container();
    }
    apps() {
      return this._installedApps;
    }
    allAppsLoaded() {
      return this._registeredAppsPromises.length === this._installedApps.length;
    }
    setBus(bus) {
      this.bus = bus;
      return this;
    }
    setUnitsSettingManager(unitsSettingManager) {
      this.unitsSettingManager = unitsSettingManager;
      return this;
    }
    setEfbSettingManager(efbSettingsManager) {
      this.efbSettingsManager = efbSettingsManager;
      return this;
    }
    setOnboardingManager(onboardingManager) {
      this.onboardingManager = onboardingManager;
      return this;
    }
    setNotificationManager(notificationManager) {
      this.notificationManager = notificationManager;
      return this;
    }
    async loadCss(uri) {
      if (document.querySelector(`link[href*="${uri}"]`)) {
        return Promise.reject(`${uri} already loaded.`);
      }
      const linkTag = document.createElement("link");
      linkTag.rel = "stylesheet";
      linkTag.href = uri;
      document.head.append(linkTag);
      return new Promise((resolve, reject) => {
        linkTag.onload = () => resolve();
        linkTag.onerror = reject;
      });
    }
    async loadJs(uri) {
      if (document.querySelector(`script[src*="${uri}"]`)) {
        return Promise.reject(`${uri} already loaded.`);
      }
      const scriptTag = document.createElement("script");
      scriptTag.type = "text/javascript";
      scriptTag.src = uri;
      document.head.append(scriptTag);
      return new Promise((resolve, reject) => {
        scriptTag.onload = () => resolve();
        scriptTag.onerror = reject;
      });
    }
    use(app, ...options) {
      var _a;
      try {
        if (!this.bus) {
          throw new Error(`Bus has not been initialized yet.`);
        }
        const appInstance = app instanceof App ? app : new app();
        const installProps = {
          bus: this.bus,
          unitsSettingManager: this.unitsSettingManager,
          efbSettingsManager: this.efbSettingsManager,
          notificationManager: this.notificationManager,
          onboardingManager: this.onboardingManager,
          options: Object.keys(options).filter((key) => key !== "isCoreApp").reduce((acc, key) => {
            return Object.assign(acc, options[key]);
          }, {})
        };
        const appInstaller = appInstance._install.apply(appInstance, [installProps]);
        const name = appInstance.internalName;
        if (/\s/.test(name)) {
          throw new Error(`The App name can't have any whitespace character. "${name}"`);
        }
        this._registeredAppsPromises.push(appInstaller.then(() => {
          this._installedApps.insert(appInstance);
        }));
      } catch (e) {
        (_a = document.currentScript) == null || _a.remove();
        console.error(`App can't be installed`, e);
        throw e;
      }
      return this;
    }
  }
  var Efb = Container.instance;
  var EfbApiVersion = "1.0.3";
  class App {
    constructor() {
      this._isInstalled = false;
      this._isReady = false;
      this._favoriteIndex = -1;
      this.available = import_msfs_sdk.Subject.create(true);
      this.BootMode = AppBootMode.COLD;
      this.SuspendMode = AppSuspendMode.SLEEP;
    }
    async _install(props) {
      var _a;
      if (this._isInstalled) {
        return Promise.reject("App already installed.");
      }
      this._isInstalled = true;
      this.bus = props.bus;
      this._unitsSettingsManager = props.unitsSettingManager;
      this._efbSettingsManager = props.efbSettingsManager;
      this._notificationManager = props.notificationManager;
      this._onboardingManager = props.onboardingManager;
      this._favoriteIndex = (_a = props.favoriteIndex) != null ? _a : -1;
      this.options = props.options;
      await this.install(props);
      this._isReady = true;
      Coherent.trigger("EFB_APP_INSTALLED", this.name, this.internalName, EfbApiVersion, this.getVersion());
      return Promise.resolve();
    }
    async install(props) {
      return Promise.resolve();
    }
    get isReady() {
      return this._isReady;
    }
    get internalName() {
      return this.constructor.name;
    }
    get unitsSettingsManager() {
      const unitsSettingsManager = this._unitsSettingsManager;
      if (!unitsSettingsManager) {
        throw new Error("Units settings manager is not defined");
      }
      return unitsSettingsManager;
    }
    get efbSettingsManager() {
      const efbSettingsManager = this._efbSettingsManager;
      if (!efbSettingsManager) {
        throw new Error("EFB settings manager is not defined");
      }
      return efbSettingsManager;
    }
    get notificationManager() {
      const notificationManager = this._notificationManager;
      if (!notificationManager) {
        throw new Error("Notification manager is not defined");
      }
      return notificationManager;
    }
    get onboardingManager() {
      const onboardingManager = this._onboardingManager;
      if (!onboardingManager) {
        throw new Error("Onboarding manager is not defined");
      }
      return onboardingManager;
    }
    get compatibleAircraftModels() {
      return;
    }
    get favoriteIndex() {
      return this._favoriteIndex;
    }
    set favoriteIndex(index2) {
      this._favoriteIndex = index2;
    }
    getIsSearchable() {
      var _a;
      return (_a = this.options.isSearchable) != null ? _a : true;
    }
    getIsFavoritable() {
      var _a;
      return (_a = this.options.isFavoritable) != null ? _a : true;
    }
    getVersion() {
      return "";
    }
  }
  function isVNode(object) {
    return "instance" in object && "props" in object && "children" in object;
  }
  function toClassProp(classProp) {
    if (classProp === void 0) {
      return classProp;
    }
    if (Array.isArray(classProp)) {
      return toClassProp(classProp.join(" "));
    }
    if (typeof classProp !== "string") {
      return classProp;
    }
    return classProp.split(" ").reduce(function(stack, el) {
      return __spreadProps(__spreadValues2({}, stack), { [el]: true });
    }, {});
  }
  function mergeClassProp(baseProp, ...args) {
    const mergedClassProp = Object.assign({}, toClassProp(baseProp));
    for (const arg of args) {
      Object.assign(mergedClassProp, toClassProp(arg));
    }
    return mergedClassProp;
  }
  function where(value2) {
    return (input) => value2 === input;
  }
  function toString() {
    return (input) => input.toString();
  }
  class _FlightPhaseManager {
    constructor() {
      this._flightPhase = import_msfs_sdk.Subject.create(100);
      this.flightPhase = this._flightPhase;
      this.isFlightOver = this._flightPhase.map(where(11));
      this.onFlightPhaseStateChangedSubscription = null;
    }
    static get instance() {
      return window.FLIGHT_PHASE_MANAGER = _FlightPhaseManager._instance = window.FLIGHT_PHASE_MANAGER || _FlightPhaseManager._instance || new _FlightPhaseManager();
    }
    setBus(bus) {
      var _a;
      (_a = this.onFlightPhaseStateChangedSubscription) == null || _a.destroy();
      this.onFlightPhaseStateChangedSubscription = bus.on("FlightPhaseChanged", (flightPhase) => {
        switch (flightPhase) {
          case "PREFLIGHT_RTC":
          case "PREFLIGHT":
          case "SKIP_TRANSITION_PREFLIGHT":
            this._flightPhase.set(0);
            break;
          case "STARTUP":
            this._flightPhase.set(1);
            break;
          case "BEFORE_TAXI":
          case "TAXI":
          case "SKIP_TRANSITION_TAXI":
            this._flightPhase.set(3);
            break;
          case "TAKEOFF":
            this._flightPhase.set(4);
            break;
          case "CLIMB":
            this._flightPhase.set(5);
            break;
          case "CRUISE":
          case "SKIP_TRANSITION_CRUISE":
            this._flightPhase.set(6);
            break;
          case "DESCENT":
            this._flightPhase.set(7);
            break;
          case "LANDING":
            this._flightPhase.set(8);
            break;
          case "TAXITOGATE":
          case "SKIP_TRANSITION_TAXITOGATE":
            this._flightPhase.set(9);
            break;
          case "SHUTDOWN":
            this._flightPhase.set(10);
            break;
          case "RTC":
            break;
          case "MISSIONSUCCESS":
          case "MISSIONABORTED":
            this._flightPhase.set(11);
            break;
          case "REACH BANNER APPROACH":
          case "HOOKBANNER":
          case "REACH PASS":
          case "PASS":
          case "CRUISEBACK":
          case "REACH DROP":
          case "DROP BANNER":
            break;
          case "WATERDROP":
            break;
          default:
            console.warn(`Received unknown flight phase '${flightPhase}'`);
            this._flightPhase.set(100);
        }
      });
    }
    hasReachedFlightPhaseState(flightPhase) {
      return this.flightPhase.map((currentFlightPhaseState) => currentFlightPhaseState >= flightPhase);
    }
  }
  var FlightPhaseManager = _FlightPhaseManager.instance;
  class _GameModeManager {
    constructor() {
      this._gameMode = import_msfs_sdk.Subject.create(0);
      this.gameMode = this._gameMode;
      this.isCareer = this._gameMode.map(where(1));
      this.isChallenge = this._gameMode.map(where(2));
      this.isDiscovery = this._gameMode.map(where(3));
      this.isFreeflight = this._gameMode.map(where(4));
      this.isInMenu = import_msfs_sdk.Subject.create(true);
      this.onGameModeChangedSubscription = null;
      this.onIsInMenuSubscription = null;
    }
    static get instance() {
      return window.GAME_MODE_MANAGER = _GameModeManager._instance = window.GAME_MODE_MANAGER || _GameModeManager._instance || new _GameModeManager();
    }
    setBus(bus) {
      var _a, _b;
      (_a = this.onGameModeChangedSubscription) == null || _a.destroy();
      (_b = this.onIsInMenuSubscription) == null || _b.destroy();
      this.onGameModeChangedSubscription = bus.on("GameModeChanged", (gameMode) => {
        switch (gameMode) {
          case "":
            this._gameMode.set(0);
            break;
          case "CAREER GAMEMODE":
            this._gameMode.set(1);
            break;
          case "CHALLENGE GAMEMODE":
            this._gameMode.set(2);
            break;
          case "DISCOVERY GAMEMODE":
            this._gameMode.set(3);
            break;
          case "FREEFLIGHT GAMEMODE":
            this._gameMode.set(4);
            break;
          default:
            console.error(`Unknown game mode '${gameMode}'`);
            this._gameMode.set(0);
        }
      });
      this.onIsInMenuSubscription = bus.on("IsInMenuUpdate", (isInMenu) => this.isInMenu.set(isInMenu));
    }
  }
  var GameModeManager = _GameModeManager.instance;
  Blob.prototype.arrayBuffer = function() {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.onload = function(event) {
        var _a;
        const arrayBuffer = (_a = event.target) == null ? void 0 : _a.result;
        if (typeof arrayBuffer === "string" || arrayBuffer === null || arrayBuffer === void 0) {
          reject("ArrayBuffer is null");
          return;
        }
        resolve(arrayBuffer);
      };
      fileReader.readAsArrayBuffer(this);
      fileReader.result;
    });
  };
  var uint8 = new Uint8Array(4);
  var uint32 = new Uint32Array(uint8.buffer);
  function isPromise(value2) {
    return value2 instanceof Promise;
  }
  function toPromise(value2) {
    return isPromise(value2) ? value2 : Promise.resolve(value2);
  }
  function checkUserSetting(setting, type) {
    if (!Object.values(type).includes(setting.get())) {
      setting.resetToDefault();
    }
  }
  var basicFormatter = import_msfs_sdk.NumberFormatter.create({
    maxDigits: 0,
    forceDecimalZeroes: false,
    nanString: "-"
  });
  var _UnitFormatter = class _UnitFormatter2 {
    static create(defaultString = "", charCase = "normal") {
      var _a, _b;
      switch (charCase) {
        case "upper":
          (_a = _UnitFormatter2.UNIT_TEXT_UPPER) != null || (_UnitFormatter2.UNIT_TEXT_UPPER = _UnitFormatter2.createUpperCase());
          return (unit) => {
            var _a2, _b2;
            return (_b2 = (_a2 = _UnitFormatter2.UNIT_TEXT_UPPER[unit.family]) == null ? void 0 : _a2[unit.name]) != null ? _b2 : defaultString;
          };
        case "lower":
          (_b = _UnitFormatter2.UNIT_TEXT_LOWER) != null || (_UnitFormatter2.UNIT_TEXT_LOWER = _UnitFormatter2.createLowerCase());
          return (unit) => {
            var _a2, _b2;
            return (_b2 = (_a2 = _UnitFormatter2.UNIT_TEXT_LOWER[unit.family]) == null ? void 0 : _a2[unit.name]) != null ? _b2 : defaultString;
          };
        default:
          return (unit) => {
            var _a2, _b2;
            return (_b2 = (_a2 = _UnitFormatter2.UNIT_TEXT[unit.family]) == null ? void 0 : _a2[unit.name]) != null ? _b2 : defaultString;
          };
      }
    }
    static createLowerCase() {
      const lower = {};
      for (const family in _UnitFormatter2.UNIT_TEXT) {
        const familyText = _UnitFormatter2.UNIT_TEXT[family];
        lower[family] = {};
        for (const unit in familyText) {
          lower[family][unit] = familyText[unit].toLowerCase();
        }
      }
      return lower;
    }
    static createUpperCase() {
      const upper = {};
      for (const family in _UnitFormatter2.UNIT_TEXT) {
        const familyText = _UnitFormatter2.UNIT_TEXT[family];
        upper[family] = {};
        for (const unit in familyText) {
          upper[family][unit] = familyText[unit].toUpperCase();
        }
      }
      return upper;
    }
    static getUnitTextMap() {
      return _UnitFormatter2.UNIT_TEXT;
    }
  };
  _UnitFormatter.UNIT_TEXT = {
    [import_msfs_sdk.UnitFamily.Distance]: {
      [import_msfs_sdk.UnitType.METER.name]: "M",
      [import_msfs_sdk.UnitType.FOOT.name]: "FT",
      [import_msfs_sdk.UnitType.KILOMETER.name]: "KM",
      [import_msfs_sdk.UnitType.NMILE.name]: "NM",
      [import_msfs_sdk.UnitType.MILE.name]: "SM"
    },
    [import_msfs_sdk.UnitFamily.Angle]: {
      [import_msfs_sdk.UnitType.DEGREE.name]: "\xB0",
      [import_msfs_sdk.UnitType.RADIAN.name]: "rad"
    },
    [import_msfs_sdk.UnitFamily.Duration]: {
      [import_msfs_sdk.UnitType.SECOND.name]: "SEC",
      [import_msfs_sdk.UnitType.MINUTE.name]: "MIN",
      [import_msfs_sdk.UnitType.HOUR.name]: "HR"
    },
    [import_msfs_sdk.UnitFamily.Weight]: {
      [import_msfs_sdk.UnitType.KILOGRAM.name]: "KG",
      [import_msfs_sdk.UnitType.POUND.name]: "LBS",
      [import_msfs_sdk.UnitType.LITER_FUEL.name]: "LT",
      [import_msfs_sdk.UnitType.GALLON_FUEL.name]: "GAL",
      [import_msfs_sdk.UnitType.IMP_GALLON_FUEL.name]: "IG"
    },
    [import_msfs_sdk.UnitFamily.Volume]: {
      [import_msfs_sdk.UnitType.LITER.name]: "L",
      [import_msfs_sdk.UnitType.GALLON.name]: "GAL"
    },
    [import_msfs_sdk.UnitFamily.Pressure]: {
      [import_msfs_sdk.UnitType.HPA.name]: "HPA",
      [import_msfs_sdk.UnitType.IN_HG.name]: "IN"
    },
    [import_msfs_sdk.UnitFamily.Temperature]: {
      [import_msfs_sdk.UnitType.CELSIUS.name]: "\xB0C",
      [import_msfs_sdk.UnitType.FAHRENHEIT.name]: "\xB0F"
    },
    [import_msfs_sdk.UnitFamily.TemperatureDelta]: {
      [import_msfs_sdk.UnitType.DELTA_CELSIUS.name]: "\xB0C",
      [import_msfs_sdk.UnitType.DELTA_FAHRENHEIT.name]: "\xB0F"
    },
    [import_msfs_sdk.UnitFamily.Speed]: {
      [import_msfs_sdk.UnitType.KNOT.name]: "KT",
      [import_msfs_sdk.UnitType.KPH.name]: "KM/H",
      [import_msfs_sdk.UnitType.MPM.name]: "MPM",
      [import_msfs_sdk.UnitType.FPM.name]: "FPM"
    },
    [import_msfs_sdk.UnitFamily.WeightFlux]: {
      [import_msfs_sdk.UnitType.KGH.name]: "KG/HR",
      [import_msfs_sdk.UnitType.PPH.name]: "LB/HR",
      [import_msfs_sdk.UnitType.LPH_FUEL.name]: "LT/HR",
      [import_msfs_sdk.UnitType.GPH_FUEL.name]: "GAL/HR",
      [import_msfs_sdk.UnitType.IGPH_FUEL.name]: "IG/HR"
    }
  };
  var UnitFormatter = _UnitFormatter;
  function value(arg) {
    return typeof arg === "function" ? arg() : arg;
  }
  class AppContainer extends import_msfs_sdk.DisplayComponent {
    constructor() {
      super(...arguments);
      this.appMainRef = import_msfs_sdk.FSComponent.createRef();
      this.appStackRef = import_msfs_sdk.FSComponent.createRef();
    }
    onAfterRender(node) {
      super.onAfterRender(node);
      this.props.appViewService.onAppContainerRendered(this.appStackRef.instance);
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", { ref: this.appMainRef, class: `app-container` }, /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(DefaultAppViewStackContainer, { ref: this.appStackRef }));
    }
  }
  class DefaultAppViewStackContainer extends import_msfs_sdk.DisplayComponent {
    constructor() {
      super(...arguments);
      this.rootRef = import_msfs_sdk.FSComponent.createRef();
    }
    renderView(view) {
      import_msfs_sdk.FSComponent.render(view, this.rootRef.instance);
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", { ref: this.rootRef, class: mergeClassProp("app-view-stack", this.props.class) });
    }
  }
  function Memoize(args) {
    let hashFunction;
    let duration;
    let tags;
    {
      hashFunction = args;
    }
    return (target, propertyKey, descriptor) => {
      if (descriptor.value != null) {
        descriptor.value = getNewFunction(descriptor.value, hashFunction, duration, tags);
      } else if (descriptor.get != null) {
        descriptor.get = getNewFunction(descriptor.get, hashFunction, duration, tags);
      } else {
        throw "Only put a Memoize() decorator on a method or get accessor.";
      }
    };
  }
  var clearCacheTagsMap = /* @__PURE__ */ new Map();
  function getNewFunction(originalMethod, hashFunction, duration = 0, tags) {
    const propMapName = /* @__PURE__ */ Symbol(`__memoized_map__`);
    return function(...args) {
      let returnedValue;
      if (!this.hasOwnProperty(propMapName)) {
        Object.defineProperty(this, propMapName, {
          configurable: false,
          enumerable: false,
          writable: false,
          value: /* @__PURE__ */ new Map()
        });
      }
      let myMap = this[propMapName];
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          if (clearCacheTagsMap.has(tag)) {
            clearCacheTagsMap.get(tag).push(myMap);
          } else {
            clearCacheTagsMap.set(tag, [myMap]);
          }
        }
      }
      if (hashFunction || args.length > 0 || duration > 0) {
        let hashKey;
        if (hashFunction === true) {
          hashKey = args.map((a) => a.toString()).join("!");
        } else if (hashFunction) {
          hashKey = hashFunction.apply(this, args);
        } else {
          hashKey = args[0];
        }
        const timestampKey = `${hashKey}__timestamp`;
        let isExpired = false;
        if (duration > 0) {
          if (!myMap.has(timestampKey)) {
            isExpired = true;
          } else {
            let timestamp = myMap.get(timestampKey);
            isExpired = Date.now() - timestamp > duration;
          }
        }
        if (myMap.has(hashKey) && !isExpired) {
          returnedValue = myMap.get(hashKey);
        } else {
          returnedValue = originalMethod.apply(this, args);
          myMap.set(hashKey, returnedValue);
          if (duration > 0) {
            myMap.set(timestampKey, Date.now());
          }
        }
      } else {
        const hashKey = this;
        if (myMap.has(hashKey)) {
          returnedValue = myMap.get(hashKey);
        } else {
          returnedValue = originalMethod.apply(this, args);
          myMap.set(hashKey, returnedValue);
        }
      }
      return returnedValue;
    };
  }
  var GamepadEvents = /* @__PURE__ */ ((GamepadEvents2) => {
    GamepadEvents2["JOYSTICK_LEFT_X_AXIS"] = "JOYSTICK_LEFT_X_AXIS";
    GamepadEvents2["JOYSTICK_LEFT_Y_AXIS"] = "JOYSTICK_LEFT_Y_AXIS";
    GamepadEvents2["JOYSTICK_RIGHT_X_AXIS"] = "JOYSTICK_RIGHT_X_AXIS";
    GamepadEvents2["JOYSTICK_RIGHT_Y_AXIS"] = "JOYSTICK_RIGH_Y_AXIS";
    GamepadEvents2["BUTTON_A"] = "BUTTON_A";
    GamepadEvents2["BUTTON_B"] = "BUTTON_B";
    GamepadEvents2["BUTTON_Y"] = "BUTTON_Y";
    GamepadEvents2["BUTTON_X"] = "BUTTON_X";
    GamepadEvents2["JOYDIR_LEFT"] = "JOYDIR_LEFT";
    GamepadEvents2["JOYDIR_RIGHT"] = "JOYDIR_RIGHT";
    GamepadEvents2["JOYDIR_UP"] = "JOYDIR_UP";
    GamepadEvents2["JOYDIR_DOWN"] = "JOYDIR_DOWN";
    return GamepadEvents2;
  })(GamepadEvents || {});
  var InputAction = /* @__PURE__ */ ((InputAction2) => {
    InputAction2[InputAction2["SECONDARY"] = 0] = "SECONDARY";
    InputAction2[InputAction2["TERTIARY"] = 1] = "TERTIARY";
    InputAction2[InputAction2["PREV"] = 2] = "PREV";
    InputAction2[InputAction2["NEXT"] = 3] = "NEXT";
    InputAction2[InputAction2["PREV_SUB"] = 4] = "PREV_SUB";
    InputAction2[InputAction2["NEXT_SUB"] = 5] = "NEXT_SUB";
    InputAction2[InputAction2["ZOOM_OUT"] = 6] = "ZOOM_OUT";
    InputAction2[InputAction2["ZOOM_IN"] = 7] = "ZOOM_IN";
    InputAction2[InputAction2["SCROLL_UP"] = 8] = "SCROLL_UP";
    InputAction2[InputAction2["SCROLL_RIGHT"] = 9] = "SCROLL_RIGHT";
    InputAction2[InputAction2["SCROLL_DOWN"] = 10] = "SCROLL_DOWN";
    InputAction2[InputAction2["SCROLL_LEFT"] = 11] = "SCROLL_LEFT";
    return InputAction2;
  })(InputAction || {});
  var InputActions = {
    [0]: "KEY_EFB_SECONDARY",
    [1]: "KEY_EFB_TERTIARY",
    [2]: "KEY_EFB_NAV_TABS_PREV",
    [3]: "KEY_EFB_NAV_TABS_NEXT",
    [4]: "KEY_EFB_ZOOM_OUT",
    [5]: "KEY_EFB_ZOOM_IN",
    [6]: "KEY_EFB_ZOOM_OUT",
    [7]: "KEY_EFB_ZOOM_IN",
    [8]: "KEY_EFB_SCROLL_UP",
    [9]: "KEY_EFB_SCROLL_RIGHT",
    [10]: "KEY_EFB_SCROLL_DOWN",
    [11]: "KEY_EFB_SCROLL_LEFT"
  };
  var InternalInputAction = /* @__PURE__ */ ((InternalInputAction2) => {
    InternalInputAction2[InternalInputAction2["VALID"] = 0] = "VALID";
    InternalInputAction2[InternalInputAction2["BACK"] = 1] = "BACK";
    InternalInputAction2[InternalInputAction2["SECONDARY"] = 2] = "SECONDARY";
    InternalInputAction2[InternalInputAction2["TERTIARY"] = 3] = "TERTIARY";
    InternalInputAction2[InternalInputAction2["PREV_TAB"] = 4] = "PREV_TAB";
    InternalInputAction2[InternalInputAction2["NEXT_TAB"] = 5] = "NEXT_TAB";
    InternalInputAction2[InternalInputAction2["ZOOM_OUT"] = 6] = "ZOOM_OUT";
    InternalInputAction2[InternalInputAction2["ZOOM_IN"] = 7] = "ZOOM_IN";
    InternalInputAction2[InternalInputAction2["UP"] = 8] = "UP";
    InternalInputAction2[InternalInputAction2["RIGHT"] = 9] = "RIGHT";
    InternalInputAction2[InternalInputAction2["DOWN"] = 10] = "DOWN";
    InternalInputAction2[InternalInputAction2["LEFT"] = 11] = "LEFT";
    InternalInputAction2[InternalInputAction2["PREV_APP"] = 12] = "PREV_APP";
    InternalInputAction2[InternalInputAction2["NEXT_APP"] = 13] = "NEXT_APP";
    InternalInputAction2[InternalInputAction2["OPEN_NOTIFICATION_MENU"] = 14] = "OPEN_NOTIFICATION_MENU";
    InternalInputAction2[InternalInputAction2["SCROLL_UP"] = 15] = "SCROLL_UP";
    InternalInputAction2[InternalInputAction2["SCROLL_RIGHT"] = 16] = "SCROLL_RIGHT";
    InternalInputAction2[InternalInputAction2["SCROLL_DOWN"] = 17] = "SCROLL_DOWN";
    InternalInputAction2[InternalInputAction2["SCROLL_LEFT"] = 18] = "SCROLL_LEFT";
    InternalInputAction2[InternalInputAction2["TEXTBOX_VALID"] = 19] = "TEXTBOX_VALID";
    InternalInputAction2[InternalInputAction2["TEXTBOX_UP"] = 20] = "TEXTBOX_UP";
    InternalInputAction2[InternalInputAction2["TEXTBOX_RIGHT"] = 21] = "TEXTBOX_RIGHT";
    InternalInputAction2[InternalInputAction2["TEXTBOX_DOWN"] = 22] = "TEXTBOX_DOWN";
    InternalInputAction2[InternalInputAction2["TEXTBOX_LEFT"] = 23] = "TEXTBOX_LEFT";
    return InternalInputAction2;
  })(InternalInputAction || {});
  var InternalInputActions = {
    [0]: "KEY_EFB_VALID",
    [1]: "KEY_EFB_BACK",
    [2]: "KEY_EFB_SECONDARY",
    [3]: "KEY_EFB_TERTIARY",
    [4]: "KEY_EFB_NAV_TABS_PREV",
    [5]: "KEY_EFB_NAV_TABS_NEXT",
    [6]: "KEY_EFB_ZOOM_OUT",
    [7]: "KEY_EFB_ZOOM_IN",
    [8]: "KEY_EFB_UP",
    [9]: "KEY_EFB_NAV_APP_NEXT",
    [10]: "KEY_EFB_DOWN",
    [11]: "KEY_EFB_NAV_APP_PREV",
    [12]: "KEY_EFB_NAV_APP_PREV",
    [13]: "KEY_EFB_NAV_APP_NEXT",
    [14]: "KEY_EFB_NOTIFICATIONS_MENU",
    [15]: "KEY_EFB_SCROLL_UP",
    [16]: "KEY_EFB_SCROLL_RIGHT",
    [17]: "KEY_EFB_SCROLL_DOWN",
    [18]: "KEY_EFB_SCROLL_LEFT",
    [19]: "KEY_EFB_VALID_TEXT",
    [20]: "KEY_EFB_TEXTBOX_UP",
    [21]: "KEY_EFB_TEXTBOX_RIGHT",
    [22]: "KEY_EFB_TEXTBOX_DOWN",
    [23]: "KEY_EFB_TEXTBOX_LEFT"
  };
  var _InputsListener = class _InputsListener2 extends ViewListener.ViewListener {
    static addInputChangeCallback(context, action, callback) {
      const idWatcher = "InputWatcher_" + context + "_" + action + "_" + import_msfs_sdk.UUID.GenerateUuid();
      _InputsListener2.inputsListener.trigger("ADD_INPUT_WATCHER", idWatcher, context, action);
      _InputsListener2.inputsListener.on("InputListener.InputChange", (id, down) => {
        if (id === idWatcher) {
          callback(down);
        }
      });
      return idWatcher;
    }
    static removeInputChangeCallback(id) {
      _InputsListener2.inputsListener.trigger("REMOVE_INPUT_WATCHER", id);
    }
  };
  _InputsListener.isLoaded = import_msfs_sdk.Subject.create(false);
  _InputsListener.inputsListener = RegisterViewListener("JS_LISTENER_INPUTS", () => _InputsListener.isLoaded.set(true));
  class InputStackListener {
    constructor() {
      this._isReady = import_msfs_sdk.Subject.create(false);
      this.isReady = this._isReady;
      this.inputActionMap = /* @__PURE__ */ new Map();
      this.inputStackListener = RegisterViewListener("JS_LISTENER_INPUT_STACK", () => this._isReady.set(true));
      this.onInputTriggeredCallback = this._onInputTriggeredCallback.bind(this);
      this.inputStackListener.on("ON_INPUT_TRIGGERED", this.onInputTriggeredCallback);
    }
    _onInputTriggeredCallback(task, value2, _activeId, uuid) {
      var _a;
      (_a = this.inputActionMap.get(uuid)) == null || _a(task, value2);
    }
    addInputAction(input, callback, inputType = "released", context = "DEFAULT") {
      const uuid = import_msfs_sdk.UUID.GenerateUuid().toUpperCase();
      const formattedUuid = `{${uuid}}`;
      this.inputActionMap.set(uuid, (task, value2) => {
        const isConsumed = callback(value2);
        this.inputStackListener.call(`RESOLVE_${task}`, isConsumed);
      });
      this.inputStackListener.trigger("ADD_INPUT_ACTION", input, formattedUuid, "", inputType, context);
      return () => {
        this.inputStackListener.trigger("REMOVE_INPUT_ACTION", input, formattedUuid);
        this.inputActionMap.delete(uuid);
      };
    }
  }
  class InternalInputManager {
    constructor(inputActionRecord) {
      this.inputActionRecord = inputActionRecord;
      this.defaultInputType = "released";
      this.defaultScrollAxis = "all";
      this.defaultScrollSpeedFactor = 10;
      this.inputStackListener = new InputStackListener();
    }
    addInputAction(inputAction, callback, options) {
      var _a;
      return this.inputStackListener.addInputAction(this.inputActionRecord[inputAction], callback, (_a = options == null ? void 0 : options.inputType) != null ? _a : this.defaultInputType);
    }
    addInputActionOnHover(element, inputAction, callback, options) {
      let inputActionDestructor = null;
      const mouseEnterCallback = () => {
        var _a;
        if (inputActionDestructor) {
          inputActionDestructor();
        }
        inputActionDestructor = this.inputStackListener.addInputAction(this.inputActionRecord[inputAction], callback, (_a = options == null ? void 0 : options.inputType) != null ? _a : this.defaultInputType);
      };
      const mouseLeaveCallback = () => {
        inputActionDestructor == null || inputActionDestructor();
      };
      element.addEventListener("mouseenter", mouseEnterCallback);
      element.addEventListener("mouseleave", mouseLeaveCallback);
      return () => {
        element.removeEventListener("mouseenter", mouseEnterCallback);
        element.removeEventListener("mouseleave", mouseLeaveCallback);
        inputActionDestructor == null || inputActionDestructor();
      };
    }
  }
  class InputManager extends InternalInputManager {
    constructor() {
      super(InputActions);
    }
    addScrollInputAction(element, options) {
      var _a;
      const scrollSpeed = options == null ? void 0 : options.scrollSpeed;
      let predicate;
      if (scrollSpeed === void 0) {
        predicate = (axis) => this.computeScrollSpeedFactor(axis, this.defaultScrollSpeedFactor);
      } else if (typeof scrollSpeed === "number") {
        predicate = (axis) => this.computeScrollSpeedFactor(axis, scrollSpeed);
      } else {
        predicate = scrollSpeed;
      }
      switch ((_a = options == null ? void 0 : options.scrollAxis) != null ? _a : this.defaultScrollAxis) {
        case "vertical":
        case "y":
          return this.setupVerticalScroll(element, predicate);
        case "horizontal":
        case "x":
          return this.setupHorizontalScroll(element, predicate);
        default: {
          const verticalScrollDestructor = this.setupVerticalScroll(element, predicate);
          const horizontalScrollDestructor = this.setupHorizontalScroll(element, predicate);
          return () => {
            verticalScrollDestructor();
            horizontalScrollDestructor();
          };
        }
      }
    }
    setupVerticalScroll(element, predicate) {
      const scrollUpInputActionDestructor = this.addInputActionOnHover(element, InputAction.SCROLL_UP, (axisValue) => {
        if (axisValue < 0) {
          return false;
        }
        element.scroll({
          top: element.scrollTop - predicate(axisValue)
        });
        return true;
      }, { inputType: "axis" });
      const scrollDownInputActionDestructor = this.addInputActionOnHover(element, InputAction.SCROLL_DOWN, (axisValue) => {
        if (axisValue < 0) {
          return false;
        }
        element.scroll({
          top: element.scrollTop + predicate(axisValue)
        });
        return true;
      }, { inputType: "axis" });
      return () => {
        scrollUpInputActionDestructor();
        scrollDownInputActionDestructor();
      };
    }
    setupHorizontalScroll(element, predicate) {
      const scrollLeftInputActionDestructor = this.addInputActionOnHover(element, InputAction.SCROLL_LEFT, (axisValue) => {
        if (axisValue < 0) {
          return false;
        }
        element.scroll({
          left: element.scrollLeft - predicate(axisValue)
        });
        return true;
      }, { inputType: "axis" });
      const scrollRightInputActionDestructor = this.addInputActionOnHover(element, InputAction.SCROLL_RIGHT, (axisValue) => {
        if (axisValue < 0) {
          return false;
        }
        element.scroll({
          left: element.scrollLeft + predicate(axisValue)
        });
        return true;
      }, { inputType: "axis" });
      return () => {
        scrollLeftInputActionDestructor();
        scrollRightInputActionDestructor();
      };
    }
    computeScrollSpeedFactor(axisValue, factor) {
      return axisValue * axisValue * factor;
    }
  }
  var _GamepadUiComponent = class _GamepadUiComponent2 extends import_msfs_sdk.DisplayComponent {
    constructor() {
      var _a, _b;
      super(...arguments);
      this.classSubscriptions = [];
      this.gamepadUiComponentRef = import_msfs_sdk.FSComponent.createRef();
      this.inputManager = new InputManager();
      this.areGamepadInputsEnabled = import_msfs_sdk.Subject.create(false);
      this._nextHandler = import_msfs_sdk.Subject.create(void 0);
      this.nextHandler = this._nextHandler;
      this.disabled = import_msfs_sdk.SubscribableUtils.toSubscribable((_a = this.props.disabled) != null ? _a : false, true);
      this.visible = import_msfs_sdk.SubscribableUtils.toSubscribable((_b = this.props.visible) != null ? _b : true, true);
      this.componentClickListener = this.handleComponentClick.bind(this);
    }
    setNextGamepadEventHandler(ref) {
      this._nextHandler.set(ref);
    }
    deletePreviousGamepadEventHandler() {
      throw new Error("Method not implemented.");
    }
    handleGamepadEvent(gamepadEvent) {
      console.log(`Received ${gamepadEvent} in handleMoveEvent`);
    }
    onAfterRender(node) {
      super.onAfterRender(node);
      const gamepadUiComponentInstance = this.gamepadUiComponentRef.getOrDefault();
      if (gamepadUiComponentInstance === null) {
        return;
      }
      const classes = mergeClassProp(this.props.class);
      Object.keys(classes).forEach((className) => {
        const subscribable = import_msfs_sdk.SubscribableUtils.toSubscribable(classes[className], true);
        this.classSubscriptions.push(subscribable.sub((value2) => {
          gamepadUiComponentInstance.classList.toggle(className, value2);
        }, true));
      });
      this.isVisibleSubscription = this.visible.sub((isVisible) => {
        gamepadUiComponentInstance.hidden = !isVisible;
      }, true);
      if (import_msfs_sdk.SubscribableUtils.isSubscribable(this.props.disabled)) {
        this.isDisabledSubscription = this.props.disabled.sub((disabled) => {
          disabled ? this.disable() : this.enable();
        }, true);
      } else {
        this.props.disabled ? this.disable() : this.enable();
      }
      window.addEventListener("click", this.componentClickListener);
      if (this.props.onboardingStepId !== void 0) {
        gamepadUiComponentInstance.setAttribute("id", this.props.onboardingStepId);
      }
    }
    handleComponentClick(e) {
      if (!this.gamepadUiComponentRef.instance.contains(e.target)) {
        this.onClickOutOfComponent(e);
      }
    }
    onButtonAPressed() {
      if (this.props.onButtonAPressed !== void 0) {
        this.props.onButtonAPressed();
      }
    }
    onButtonBPressed() {
      if (this.props.onButtonBPressed !== void 0) {
        this.props.onButtonBPressed();
      }
    }
    onClickOutOfComponent(_e) {
      return;
    }
    enableGamepadInputs() {
      if (this.areGamepadInputsEnabled.get()) {
        console.warn("Trying to enable gamepad inputs that are already enabled. Operation cancelled.");
        return;
      }
      this.areGamepadInputsEnabled.set(true);
    }
    disableGamepadInputs() {
      this.areGamepadInputsEnabled.set(false);
    }
    enable() {
      this.gamepadUiComponentRef.instance.removeAttribute("disabled");
    }
    disable() {
      this.gamepadUiComponentRef.instance.setAttribute("disabled", "");
    }
    show() {
      this.gamepadUiComponentRef.instance.style.visibility = "visible";
    }
    hide() {
      this.gamepadUiComponentRef.instance.style.visibility = "hidden";
    }
    toggleFocus(value2) {
      if (value2 !== void 0) {
        if (value2 === true) {
          this.gamepadUiComponentRef.instance.classList.add(_GamepadUiComponent2.FOCUS_CLASS);
        } else {
          this.gamepadUiComponentRef.instance.classList.remove(_GamepadUiComponent2.FOCUS_CLASS);
        }
        return;
      }
      this.gamepadUiComponentRef.instance.classList.toggle(_GamepadUiComponent2.FOCUS_CLASS);
    }
    getComponentRect() {
      return this.gamepadUiComponentRef.instance.getBoundingClientRect();
    }
    destroy() {
      var _a, _b;
      this.classSubscriptions.forEach((subscription) => subscription.destroy());
      (_a = this.isVisibleSubscription) == null || _a.destroy();
      (_b = this.isDisabledSubscription) == null || _b.destroy();
      window.removeEventListener("click", this.componentClickListener);
      super.destroy();
    }
  };
  _GamepadUiComponent.FOCUS_CLASS = "focus";
  var GamepadUiComponent = _GamepadUiComponent;
  class GamepadUiParser {
    constructor() {
      this.gamepadUiViewVNode = null;
    }
    bindVNodeReference(gamepadUiViewVNode) {
      this.gamepadUiViewVNode = gamepadUiViewVNode;
      this.focusFirstElement();
    }
    focusFirstElement() {
      if (this.currentElement = this.findFirstElement()) {
        this.currentElement.instance.toggleFocus(true);
      }
    }
    goUp() {
      this.goDir("UP");
    }
    goRight() {
      this.goDir("RIGHT");
    }
    goDown() {
      this.goDir("DOWN");
    }
    goLeft() {
      this.goDir("LEFT");
    }
    pushButtonA() {
      var _a;
      (_a = this.currentElement) == null || _a.instance.onButtonAPressed();
    }
    pushButtonB() {
      var _a;
      (_a = this.currentElement) == null || _a.instance.onButtonBPressed();
    }
    goDir(dir) {
      const HTMLElementList = this.parseDOM();
      if (!this.currentElement || HTMLElementList === null) {
        return;
      }
      const nextElement = this.findClosestNode(this.currentElement, HTMLElementList, dir);
      if (nextElement !== null) {
        this.currentElement.instance.toggleFocus(false);
        this.currentElement = nextElement;
        this.currentElement.instance.toggleFocus(true);
      }
    }
    parseDOM() {
      if (this.gamepadUiViewVNode === null) {
        throw new Error(`Can't parse DOM, VNode is null`);
      }
      const VNodeList = [];
      import_msfs_sdk.FSComponent.visitNodes(this.gamepadUiViewVNode, (node) => {
        if (node.instance instanceof GamepadUiComponent) {
          const ref = import_msfs_sdk.FSComponent.createRef();
          ref.instance = node.instance;
          VNodeList.push(ref);
        }
        return false;
      });
      return VNodeList.length ? VNodeList : null;
    }
    findFirstElement() {
      const HTMLElementList = this.parseDOM();
      if (HTMLElementList === null) {
        return null;
      }
      return HTMLElementList[0];
    }
    findClosestNode(currentGamepadUiComponent, gamepadUiComponentList, direction) {
      let candidateIndex = -1;
      switch (direction) {
        case "UP":
          candidateIndex = this.findBestCandidate(currentGamepadUiComponent, gamepadUiComponentList, "bottom", "top");
          break;
        case "RIGHT":
          candidateIndex = this.findBestCandidate(currentGamepadUiComponent, gamepadUiComponentList, "left", "right");
          break;
        case "DOWN":
          candidateIndex = this.findBestCandidate(currentGamepadUiComponent, gamepadUiComponentList, "top", "bottom");
          break;
        case "LEFT":
          candidateIndex = this.findBestCandidate(currentGamepadUiComponent, gamepadUiComponentList, "right", "left");
          break;
      }
      if (candidateIndex !== -1 && candidateIndex < gamepadUiComponentList.length) {
        return gamepadUiComponentList[candidateIndex];
      }
      return null;
    }
    findBestCandidate(currentGamepadUiComponent, gamepadUiComponentList, side1, side2) {
      const htmlElementCandidates = [];
      let closestDistance = Infinity;
      let candidateIndex = -1;
      const currentHTMLElementRect = currentGamepadUiComponent.instance.getComponentRect();
      gamepadUiComponentList.forEach((htmlElement, index2) => {
        const htmlElementRect = htmlElement.instance.getComponentRect();
        if (this.isRectPosValid(htmlElementRect, currentHTMLElementRect, side1, side2, false)) {
          if (!htmlElementCandidates.some((htmlElementCandidate) => this.isRectPosValid(htmlElementRect, htmlElementCandidate.instance.getComponentRect(), side1, side1, true))) {
            htmlElementCandidates.push(htmlElement);
            const corner = side1 === "bottom" || side1 === "top" ? "left" : "top";
            const distance = this.distances1D(htmlElementRect, currentHTMLElementRect, corner);
            if (distance <= closestDistance) {
              closestDistance = distance;
              candidateIndex = index2;
            }
          }
        }
      });
      return candidateIndex;
    }
    isRectPosValid(rect1, rect2, side1, side2, strict) {
      if (side1 === "bottom" || side1 === "right") {
        if (strict) {
          return rect1[side1] < rect2[side2];
        } else {
          return rect1[side1] <= rect2[side2];
        }
      } else {
        if (strict) {
          return rect1[side1] > rect2[side2];
        } else {
          return rect1[side1] >= rect2[side2];
        }
      }
    }
    distances1D(rect1, rect2, side) {
      return Math.abs(rect2[side] - rect1[side]);
    }
  }
  class UiView extends import_msfs_sdk.DisplayComponent {
    constructor() {
      super(...arguments);
      this.services = [];
    }
    onOpen() {
      var _a;
      for (const service of this.services) {
        (_a = service.onOpen) == null || _a.call(service);
      }
    }
    onClose() {
      var _a;
      for (const service of this.services) {
        (_a = service.onClose) == null || _a.call(service);
      }
    }
    onResume() {
      var _a;
      for (const service of this.services) {
        (_a = service.onResume) == null || _a.call(service);
      }
    }
    onPause() {
      var _a;
      for (const service of this.services) {
        (_a = service.onPause) == null || _a.call(service);
      }
    }
    onUpdate(time) {
      var _a;
      for (const service of this.services) {
        (_a = service.onUpdate) == null || _a.call(service, time);
      }
    }
    destroy() {
      var _a;
      for (const service of this.services) {
        (_a = service.destroy) == null || _a.call(service);
      }
      super.destroy();
    }
  }
  class GamepadUiView extends UiView {
    constructor() {
      super(...arguments);
      this.gamepadUiViewRef = import_msfs_sdk.FSComponent.createRef();
      this.gamepadUiParser = new GamepadUiParser();
      this._nextHandler = import_msfs_sdk.Subject.create(void 0);
      this.nextHandler = this._nextHandler;
      this.inputManager = new InputManager();
      this.gamepadComponentChildren = [];
      this.areGamepadInputsEnabled = import_msfs_sdk.Subject.create(false);
      this.viewCoreInputManager = new InternalInputManager(InternalInputActions);
    }
    enableGamepadInputs() {
      if (this.areGamepadInputsEnabled.get()) {
        console.warn("Trying to enable gamepad inputs that are already enabled. Operation cancelled.");
        return;
      }
      this.goBackActionDestructor = this.viewCoreInputManager.addInputAction(InternalInputAction.BACK, () => {
        if (this.props.appViewService === void 0) {
          return false;
        }
        try {
          this.props.appViewService.goBack();
        } catch (e) {
          return false;
        }
        return true;
      });
      this.gamepadComponentChildren.forEach((child) => child.enableGamepadInputs());
      this.areGamepadInputsEnabled.set(true);
    }
    disableGamepadInputs() {
      var _a;
      (_a = this.goBackActionDestructor) == null || _a.call(this);
      this.gamepadComponentChildren.forEach((child) => child.disableGamepadInputs());
      this.areGamepadInputsEnabled.set(false);
    }
    onClose() {
      super.onClose();
      this.disableGamepadInputs();
    }
    onResume() {
      super.onResume();
      this.enableGamepadInputs();
    }
    onPause() {
      super.onPause();
      this.disableGamepadInputs();
    }
    onAfterRender(node) {
      super.onAfterRender(node);
      this.gamepadUiParser.bindVNodeReference(node);
      import_msfs_sdk.FSComponent.visitNodes(node, (childNode) => {
        if (childNode.instance instanceof GamepadUiComponent) {
          this.gamepadComponentChildren.push(childNode.instance);
        }
        return false;
      });
    }
    destroy() {
      super.destroy();
      this.disableGamepadInputs();
    }
    setNextGamepadEventHandler(ref) {
      this._nextHandler.set(ref);
    }
    deletePreviousGamepadEventHandler() {
      this._nextHandler.set(void 0);
    }
    handleGamepadEvent(_gamepadEvent) {
      if (_gamepadEvent === GamepadEvents.BUTTON_B) {
        this.gamepadUiParser.pushButtonB();
      }
      const nextHandler = this._nextHandler.get();
      if (nextHandler !== void 0) {
        return nextHandler.handleGamepadEvent(_gamepadEvent);
      }
      switch (_gamepadEvent) {
        case GamepadEvents.JOYDIR_UP:
          this.gamepadUiParser.goUp();
          break;
        case GamepadEvents.JOYDIR_RIGHT:
          this.gamepadUiParser.goRight();
          break;
        case GamepadEvents.JOYDIR_DOWN:
          this.gamepadUiParser.goDown();
          break;
        case GamepadEvents.JOYDIR_LEFT:
          this.gamepadUiParser.goLeft();
          break;
        case GamepadEvents.BUTTON_A:
          this.gamepadUiParser.pushButtonA();
          break;
      }
    }
  }
  var ViewBootMode = /* @__PURE__ */ ((ViewBootMode2) => {
    ViewBootMode2[ViewBootMode2["COLD"] = 0] = "COLD";
    ViewBootMode2[ViewBootMode2["HOT"] = 1] = "HOT";
    return ViewBootMode2;
  })(ViewBootMode || {});
  var ViewSuspendMode = /* @__PURE__ */ ((ViewSuspendMode2) => {
    ViewSuspendMode2[ViewSuspendMode2["SLEEP"] = 0] = "SLEEP";
    ViewSuspendMode2[ViewSuspendMode2["TERMINATE"] = 1] = "TERMINATE";
    return ViewSuspendMode2;
  })(ViewSuspendMode || {});
  var defaultViewOptions = {
    BootMode: ViewBootMode.COLD,
    SuspendMode: ViewSuspendMode.SLEEP
  };
  class AppViewService {
    constructor(bus) {
      this.registeredUiViewEntries = /* @__PURE__ */ new Map();
      this.appViewStack = [];
      this.registeredUiViewPromises = [];
      this.hasInitialized = false;
      this._currentUiView = import_msfs_sdk.Subject.create(null);
      this.currentUiView = this._currentUiView;
      this.bus = bus;
      this.goHomeSub = this.bus.on("_efb_appviewservice_go_home", () => {
        const steps = this.appViewStack.length - 1;
        if (steps >= 1) {
          this.goBack(steps);
        }
      }, true);
    }
    onOpen() {
      var _a, _b;
      this.goHomeSub.resume();
      (_b = (_a = this.getActiveUiViewEntry()) == null ? void 0 : _a.ref) == null || _b.onOpen();
    }
    onClose() {
      var _a, _b;
      this.goHomeSub.pause();
      (_b = (_a = this.getActiveUiViewEntry()) == null ? void 0 : _a.ref) == null || _b.onClose();
    }
    onResume() {
      var _a, _b;
      this.goHomeSub.resume();
      (_b = (_a = this.getActiveUiViewEntry()) == null ? void 0 : _a.ref) == null || _b.onResume();
    }
    onPause() {
      var _a, _b;
      this.goHomeSub.pause();
      (_b = (_a = this.getActiveUiViewEntry()) == null ? void 0 : _a.ref) == null || _b.onPause();
    }
    registerView(key, type, vNodeFactory, options) {
      if (this.registeredUiViewEntries.has(key)) {
        throw new Error(`View "${key}" is already used`);
      } else if (typeof vNodeFactory !== "function") {
        throw new Error("vNodeFactory has to be a function returning a VNode");
      }
      const viewOptions = Object.assign({}, defaultViewOptions, options);
      const appViewEntry = {
        key,
        render: vNodeFactory,
        vNode: vNodeFactory,
        ref: null,
        containerRef: import_msfs_sdk.FSComponent.createRef(),
        isVisible: import_msfs_sdk.Subject.create(false),
        layer: import_msfs_sdk.Subject.create(-1),
        type: import_msfs_sdk.Subject.create(type),
        isInit: false,
        viewOptions
      };
      if (viewOptions.BootMode === ViewBootMode.HOT) {
        this.initViewEntry(appViewEntry);
      }
      this.registeredUiViewEntries.set(key, appViewEntry);
      return appViewEntry;
    }
    registerPage(key, vNodeFactory, options) {
      return this.registerView(key, "page", vNodeFactory, options);
    }
    registerPopup(key, vNodeFactory, options) {
      return this.registerView(key, "popup", vNodeFactory, options);
    }
    async killView(viewEntry) {
      var _a;
      if (viewEntry.isInit === false) {
        return;
      }
      if (this.appViewStack.find((view) => view.key === viewEntry.key)) {
        throw new Error("You must close your view before killing it");
      }
      viewEntry.isInit = false;
      (_a = viewEntry.ref) == null || _a.destroy();
      viewEntry.containerRef.instance.destroy();
      viewEntry.ref = null;
      viewEntry.containerRef = import_msfs_sdk.FSComponent.createRef();
      viewEntry.vNode = viewEntry.render.bind(viewEntry);
      return new Promise((resolve) => {
        if (viewEntry.viewOptions.BootMode === ViewBootMode.HOT) {
          this.initViewEntry(viewEntry);
        }
        resolve();
      });
    }
    initViewEntry(entry, shouldOpen = false) {
      var _a;
      if (entry.isInit) {
        return;
      }
      entry.isInit = true;
      entry.vNode = value(entry.vNode);
      entry.ref = entry.vNode.instance;
      (_a = this.appViewRef) == null || _a.renderView(/* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(AppViewWrapper, {
        viewName: entry.key,
        isVisible: entry.isVisible,
        type: entry.type,
        layer: entry.layer,
        ref: entry.containerRef
      }, entry.vNode));
      shouldOpen && entry.ref.onOpen();
    }
    unload() {
      var _a;
      this.registeredUiViewPromises = [];
      for (const viewEntry of this.registeredUiViewEntries.values()) {
        (_a = viewEntry.ref) == null || _a.destroy();
      }
      this.registeredUiViewEntries.clear();
      this.appViewStack.splice(0, this.appViewStack.length);
      this.hasInitialized = false;
    }
    async initialize(homePageUiViewKey) {
      if (this.hasInitialized) {
        return Promise.resolve();
      }
      return Promise.all(this.registeredUiViewPromises).then(() => {
        this.initializeAppViewStack(homePageUiViewKey);
        this.hasInitialized = true;
      });
    }
    getActiveUiViewEntry() {
      const activeViewEntry = import_msfs_sdk.ArrayUtils.peekLast(this.appViewStack);
      return activeViewEntry;
    }
    on(_event, _viewKey, _callback) {
      return this;
    }
    handleCloseView(page) {
      var _a;
      if (!page || page.isVisible.get() === false)
        return;
      (_a = page.ref) == null || _a.onPause();
      page.isVisible.set(false);
      this._currentUiView.set(null);
      if (page.viewOptions.SuspendMode === ViewSuspendMode.TERMINATE) {
        setTimeout(() => this.killView(page));
      }
    }
    handleOpenView(page) {
      var _a;
      if (!page || page.isVisible.get() === true)
        return;
      (_a = page.ref) == null || _a.onResume();
      page.isVisible.set(true);
      this._currentUiView.set(page);
    }
    initializeAppViewStack(mainPageUiViewKey) {
      this.open(mainPageUiViewKey);
    }
    getUiViewEntry(key) {
      const appViewEntry = this.registeredUiViewEntries.get(key);
      if (!appViewEntry) {
        throw new Error(`${key} wasn't registered as a view`);
      }
      return appViewEntry;
    }
    onAppContainerRendered(appViewRef) {
      this.appViewRef = appViewRef;
    }
    isInViewStack(view) {
      const key = typeof view === "string" ? view : view.key;
      return this.appViewStack.findIndex((stackViewEntry) => key === stackViewEntry.key) !== -1;
    }
    isActive(view) {
      const key = typeof view === "string" ? view : view.key;
      const activeViewEntry = this.getActiveUiViewEntry();
      if (activeViewEntry === void 0) {
        return false;
      }
      return key === activeViewEntry.key;
    }
    open(key) {
      const viewEntry = this.advanceViewStack(key);
      return viewEntry;
    }
    goBack(steps) {
      steps != null || (steps = 1);
      if (steps <= 0) {
        throw new RangeError(`Steps must be superior to 0.`);
      } else if (steps >= this.appViewStack.length) {
        throw new RangeError(`Steps can't be superior to ${this.appViewStack.length} when called.`);
      }
      const activeViewEntry = this.getActiveUiViewEntry();
      if (this.appViewStack.length > steps && activeViewEntry) {
        const viewsToOpen = [];
        const viewsToClose = [];
        while (steps--) {
          const view = this.appViewStack.pop();
          if (view) {
            viewsToClose.push(view);
          }
        }
        let i = this.appViewStack.length;
        do {
          viewsToOpen.push(this.appViewStack[--i]);
        } while (i > 0 && this.appViewStack[i].type.get() !== "page");
        for (const page of viewsToClose) {
          this.handleCloseView(page);
        }
        for (const page of viewsToOpen.reverse()) {
          this.handleOpenView(page);
        }
      }
      return this.getActiveUiViewEntry();
    }
    advanceViewStack(key) {
      const viewEntry = this.getUiViewEntry(key);
      if (this.appViewStack.includes(viewEntry)) {
        if (this.getActiveUiViewEntry() !== viewEntry) {
          throw new Error("Page or popup is already in the viewstack and can't be opened twice");
        }
        return viewEntry;
      }
      switch (viewEntry.type.get()) {
        case "page":
          for (const page of [...this.appViewStack].reverse()) {
            this.handleCloseView(page);
          }
          break;
      }
      this.appViewStack.push(viewEntry);
      this.openView(viewEntry);
      this.handleOpenView(viewEntry);
      return viewEntry;
    }
    openView(view) {
      if (!view.isInit) {
        this.initViewEntry(view, true);
      }
      const index2 = this.appViewStack.indexOf(view);
      if (index2 < 0) {
        throw new Error(`AppViewService: view not found in view stack: ${view.key}`);
      }
      view.layer.set(index2);
    }
    update(time) {
      this.registeredUiViewEntries.forEach((UiView2) => {
        var _a;
        if (UiView2.isInit && UiView2.isVisible.get()) {
          (_a = UiView2.ref) == null || _a.onUpdate(time);
        }
      });
    }
    routeGamepadInteractionEvent(gamepadEvent) {
      const _currentUiView = this.getActiveUiViewEntry();
      if ((_currentUiView == null ? void 0 : _currentUiView.ref) instanceof GamepadUiView) {
        _currentUiView.ref.handleGamepadEvent(gamepadEvent);
      }
    }
  }
  class AppViewWrapper extends import_msfs_sdk.DisplayComponent {
    constructor() {
      super(...arguments);
      this.rootRef = import_msfs_sdk.FSComponent.createRef();
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", {
        ref: this.rootRef,
        class: {
          "ui-view": true,
          [this.props.viewName]: true,
          hidden: this.props.isVisible.map(import_msfs_sdk.SubscribableMapFunctions.not()),
          page: this.props.type.map(where("page")),
          popup: this.props.type.map(where("popup"))
        },
        style: {
          "z-index": this.props.layer.map(toString())
        }
      }, this.props.children);
    }
    destroy() {
      var _a;
      const root = this.rootRef.getOrDefault();
      if (root !== null) {
        (_a = root.parentNode) == null || _a.removeChild(root);
      }
      super.destroy();
    }
  }
  var __defProp222 = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __decorateClass = (decorators, target, key, kind) => {
    var result = __getOwnPropDesc(target, key);
    for (var i = decorators.length - 1, decorator; i >= 0; i--)
      if (decorator = decorators[i])
        result = decorator(target, key, result) || result;
    if (result)
      __defProp222(target, key, result);
    return result;
  };
  class AppView extends import_msfs_sdk.DisplayComponent {
    constructor(props) {
      var _a;
      super(props);
      this.rootRef = import_msfs_sdk.FSComponent.createRef();
      this.pageKeyActions = /* @__PURE__ */ new Map();
      this._appViewService = props.appViewService || (props.bus ? new AppViewService(props.bus) : void 0);
      this._bus = (_a = this._appViewService) == null ? void 0 : _a.bus;
      this._unitsSettingManager = props.unitsSettingManager;
      this._efbSettingsManager = props.efbSettingsManager;
      this._notificationManager = props.notificationManager;
      this._onboardingManager = props.onboardingManager;
    }
    get appViewService() {
      const _appViewService = this._appViewService;
      if (!_appViewService) {
        throw new Error(`Cannot resolve 'appViewService' because none of 'appViewService' and 'bus' props were given.`);
      }
      return _appViewService;
    }
    get bus() {
      const _bus = this._bus;
      if (!_bus) {
        throw new Error(`Cannot resolve 'bus' because none of 'appViewService' and 'bus' props were given.`);
      }
      return _bus;
    }
    get unitsSettingManager() {
      const _unitsSettingManager = this._unitsSettingManager;
      if (_unitsSettingManager === void 0) {
        throw new Error(`Cannot resolve 'unitsSettingManager'`);
      }
      return _unitsSettingManager;
    }
    get efbSettingsManager() {
      const _efbSettingsManager = this._efbSettingsManager;
      if (_efbSettingsManager === void 0) {
        throw new Error(`Cannot resolve 'efbSettingsManager'`);
      }
      return _efbSettingsManager;
    }
    get notificationManager() {
      const notificationManager = this._notificationManager;
      if (!notificationManager) {
        throw new Error("Notification manager is not defined");
      }
      return notificationManager;
    }
    get onboardingManager() {
      const _onboardingManager = this._onboardingManager;
      if (!_onboardingManager) {
        throw new Error(`Cannot resolve 'onboardingManager'`);
      }
      return _onboardingManager;
    }
    onOpen() {
      var _a;
      (_a = this._appViewService) == null || _a.onOpen();
    }
    onClose() {
      var _a;
      (_a = this._appViewService) == null || _a.onClose();
    }
    onResume() {
      var _a;
      (_a = this._appViewService) == null || _a.onResume();
    }
    onPause() {
      var _a;
      (_a = this._appViewService) == null || _a.onPause();
    }
    onUpdate(time) {
      var _a;
      (_a = this._appViewService) == null || _a.update(time);
    }
    registerViews() {
    }
    routeGamepadInteractionEvent(gamepadEvent) {
      var _a;
      (_a = this._appViewService) == null || _a.routeGamepadInteractionEvent(gamepadEvent);
    }
    handlePageKeyAction(key, args) {
      if (key === null) {
        return;
      }
      const action = this.pageKeyActions.get(key);
      if (action === void 0) {
        console.error(`Key "${key}" doesn't exists.`);
        return;
      }
      toPromise(action(args)).catch((reason) => {
        console.error(`handlePageKeyAction Error for key "${key}"`, reason);
      });
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(AppContainer, { appViewService: this.appViewService });
    }
    onAfterRender(node) {
      var _a;
      super.onAfterRender(node);
      this.registerViews();
      if (this.defaultView) {
        (_a = this._appViewService) == null || _a.initialize(this.defaultView);
      }
    }
    destroy() {
      var _a;
      (_a = this._appViewService) == null || _a.unload();
      super.destroy();
    }
  }
  __decorateClass([
    Memoize()
  ], AppView.prototype, "appViewService");
  __decorateClass([
    Memoize()
  ], AppView.prototype, "bus");
  __decorateClass([
    Memoize()
  ], AppView.prototype, "unitsSettingManager");
  __decorateClass([
    Memoize()
  ], AppView.prototype, "efbSettingsManager");
  __decorateClass([
    Memoize()
  ], AppView.prototype, "onboardingManager");
  class Button extends GamepadUiComponent {
    constructor() {
      var _a, _b, _c, _d;
      super(...arguments);
      this.isButtonDisabled = import_msfs_sdk.SubscribableUtils.toSubscribable((_a = this.props.disabled) != null ? _a : false, true);
      this.isButtonHoverable = import_msfs_sdk.MappedSubject.create(([isHoverable, isDisabled]) => {
        return isHoverable && !isDisabled;
      }, import_msfs_sdk.SubscribableUtils.toSubscribable((_b = this.props.hoverable) != null ? _b : true, true), this.isButtonDisabled);
      this.isButtonSelected = import_msfs_sdk.MappedSubject.create(([isSelected, state]) => isSelected || state, import_msfs_sdk.SubscribableUtils.toSubscribable((_c = this.props.selected) != null ? _c : false, true), import_msfs_sdk.SubscribableUtils.toSubscribable((_d = this.props.state) != null ? _d : false, true));
    }
    buttonRender() {
      return null;
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("button", {
        ref: this.gamepadUiComponentRef,
        class: mergeClassProp("button", "abstract-button", {
          hoverable: this.isButtonHoverable,
          selected: this.isButtonSelected
        }, this.props.class),
        style: this.props.style
      }, /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", { class: "disabled-layer" }), this.props.children, this.buttonRender());
    }
    onAfterRender(node) {
      super.onAfterRender(node);
      if (this.props.callback) {
        this.gamepadUiComponentRef.instance.onclick = (event) => {
          var _a;
          if (this.isButtonDisabled.get() === true) {
            return;
          }
          (_a = this.props.callback) == null || _a.call(this, event);
        };
      }
    }
    destroy() {
      this.isButtonHoverable.destroy();
      super.destroy();
    }
  }
  var _GamepadListNavigationManager = class _GamepadListNavigationManager2 {
    constructor(data, toolbox) {
      var _a, _b;
      this.data = data;
      this.toolbox = toolbox;
      this.allowedUpcomingNavigationMs = 0;
      this.currentItemIndex = import_msfs_sdk.Subject.create(-1);
      this.isListFocusedSubscriptions = [];
      this.currentItemIndexSubscription = this.currentItemIndex.sub((index2) => {
        var _a2, _b2;
        const item = index2 < 0 || index2 >= this.data.length ? null : this.data.get(index2);
        (_b2 = (_a2 = this.toolbox).onItemHovered) == null || _b2.call(_a2, item, index2);
      });
      this.internalInputManager = new InternalInputManager(InternalInputActions);
      this.navigationBetweenItemsDelayMs = (_a = toolbox.navigationBetweenItemsDelayMs) != null ? _a : _GamepadListNavigationManager2.defaultNavigationBetweenItemsDelayMs;
      if (toolbox.wrap) {
        this.computeUpcomingItemIndex = (previousItemIndex, step) => (this.data.length + previousItemIndex + step) % this.data.length;
      } else {
        this.computeUpcomingItemIndex = (previousItemIndex, step) => {
          const upcomingItemIndex = previousItemIndex + step;
          if (upcomingItemIndex >= 0 && upcomingItemIndex < this.data.length) {
            return upcomingItemIndex;
          } else {
            return previousItemIndex;
          }
        };
      }
      if (import_msfs_sdk.SubscribableUtils.isMutableSubscribable(toolbox.isListFocused)) {
        this.isListFocused = toolbox.isListFocused;
      } else if (import_msfs_sdk.SubscribableUtils.isSubscribable(toolbox.isListFocused)) {
        this.isListFocused = import_msfs_sdk.Subject.create(toolbox.isListFocused.get());
        this.isListFocusedSubscriptions.push(toolbox.isListFocused.sub((value2) => this.isListFocused.set(value2)));
      } else {
        this.isListFocused = import_msfs_sdk.Subject.create((_b = toolbox.isListFocused) != null ? _b : false);
      }
      this.isListFocusedSubscriptions.push(import_msfs_sdk.MappedSubject.create(([is2D, isFocused]) => {
        if (is2D && isFocused) {
          this.enableGamepadNavigation();
        } else {
          this.disableGamepadNavigation();
        }
      }, window.PanelInfo.is2D, this.isListFocused));
    }
    navigateThroughList(step) {
      const currentNavigationTryMs = Date.now();
      if (currentNavigationTryMs < this.allowedUpcomingNavigationMs) {
        return false;
      }
      this.allowedUpcomingNavigationMs = currentNavigationTryMs + this.navigationBetweenItemsDelayMs;
      const currentItemIndex = this.currentItemIndex.get();
      if (currentItemIndex === -1) {
        return false;
      }
      const upcomingItemIndex = this.computeUpcomingItemIndex(currentItemIndex, step);
      this.currentItemIndex.set(upcomingItemIndex);
      return true;
    }
    enableGamepadNavigation() {
      Coherent.trigger("SET_EFB_GAMEPAD_NAVIGATION", true);
      this.currentItemIndex.set(0);
      this.unfocusListActionDestructor = this.internalInputManager.addInputAction(InternalInputAction.BACK, () => {
        this.isListFocused.set(false);
        return true;
      });
      this.selectItemActionDestructor = this.internalInputManager.addInputAction(InternalInputAction.VALID, () => {
        var _a, _b;
        const currentItemIndex = this.currentItemIndex.get();
        try {
          (_b = (_a = this.toolbox).onItemSelected) == null || _b.call(_a, this.data.get(currentItemIndex), currentItemIndex);
        } catch (e) {
          return false;
        }
        return true;
      });
      this.allowedUpcomingNavigationMs = Date.now();
      this.prevItemActionDestructor = this.internalInputManager.addInputAction(InternalInputAction.UP, () => this.navigateThroughList(-1), { inputType: "axis" });
      this.nextItemActionDestructor = this.internalInputManager.addInputAction(InternalInputAction.DOWN, () => this.navigateThroughList(1), { inputType: "axis" });
    }
    disableGamepadNavigation() {
      var _a, _b, _c, _d;
      (_a = this.unfocusListActionDestructor) == null || _a.call(this);
      this.unfocusListActionDestructor = void 0;
      (_b = this.selectItemActionDestructor) == null || _b.call(this);
      this.selectItemActionDestructor = void 0;
      (_c = this.prevItemActionDestructor) == null || _c.call(this);
      this.prevItemActionDestructor = void 0;
      (_d = this.nextItemActionDestructor) == null || _d.call(this);
      this.nextItemActionDestructor = void 0;
      this.currentItemIndex.set(-1);
      Coherent.trigger("SET_EFB_GAMEPAD_NAVIGATION", false);
    }
    pause() {
      this.disableGamepadNavigation();
      this.currentItemIndexSubscription.pause();
      this.isListFocusedSubscriptions.forEach((subscription) => {
        subscription.pause();
      });
    }
    resume() {
      this.currentItemIndexSubscription.resume(this.isListFocused.get());
      this.isListFocusedSubscriptions.forEach((subscription) => {
        subscription.resume(true);
      });
    }
    destroy() {
      this.currentItemIndexSubscription.destroy();
      this.isListFocusedSubscriptions.forEach((subscription) => {
        subscription.destroy();
      });
      this.disableGamepadNavigation();
    }
  };
  _GamepadListNavigationManager.defaultNavigationBetweenItemsDelayMs = 100;
  class IconElement extends import_msfs_sdk.DisplayComponent {
    constructor() {
      super(...arguments);
      this.url = import_msfs_sdk.SubscribableUtils.toSubscribable(this.props.url, true);
      this.el = import_msfs_sdk.FSComponent.createRef();
      this.onSVGIconLoaded = (found, svgAsString) => {
        this.el.instance.innerText = "";
        if (!found) {
          console.error(`Image ${this.url.get()} was not found`);
          return;
        }
        const template = document.createElement("template");
        template.innerHTML = svgAsString;
        const svgAsHtml = template.content.querySelector("svg");
        if (svgAsHtml) {
          this.el.instance.appendChild(svgAsHtml);
        }
      };
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", { ref: this.el, class: mergeClassProp("icon-element", this.props.class) });
    }
    onAfterRender(node) {
      super.onAfterRender(node);
      this.urlSub = this.url.sub((url) => {
        if (url.endsWith(".svg")) {
          getIconCacheMgr().loadURL(url, this.onSVGIconLoaded);
        } else {
          this.el.instance.innerHTML = `<img src="${url}" onerror="console.error('Image ${url} was not found')" />`;
        }
      }, true);
    }
    destroy() {
      var _a;
      (_a = this.urlSub) == null || _a.destroy();
      super.destroy();
    }
  }
  class IconButton extends import_msfs_sdk.DisplayComponent {
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(Button, {
        class: mergeClassProp("icon-button", this.props.class),
        style: this.props.style,
        callback: this.props.callback,
        hoverable: this.props.hoverable,
        selected: this.props.selected,
        state: this.props.state,
        disabled: this.props.disabled,
        onboardingStepId: this.props.onboardingStepId
      }, /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(IconElement, { url: this.props.iconPath }));
    }
  }
  var _BearingDisplay = class _BearingDisplay2 extends import_msfs_sdk.AbstractNumberUnitDisplay {
    constructor() {
      var _a;
      super(...arguments);
      this.unitFormatter = (_a = this.props.unitFormatter) != null ? _a : _BearingDisplay2.DEFAULT_UNIT_FORMATTER;
      this.unitTextBigDisplay = import_msfs_sdk.Subject.create("");
      this.unitTextSmallDisplay = import_msfs_sdk.Subject.create("");
      this.numberText = import_msfs_sdk.Subject.create("");
      this.unitTextBig = import_msfs_sdk.Subject.create("");
      this.unitTextSmall = import_msfs_sdk.Subject.create("");
    }
    onValueChanged(value2) {
      let displayUnit = this.displayUnit.get();
      if (!displayUnit || !value2.unit.canConvert(displayUnit)) {
        displayUnit = value2.unit;
      }
      const numberValue = value2.asUnit(displayUnit);
      this.updateNumberText(numberValue);
      this.updateUnitText(numberValue, displayUnit);
      if (this.props.hideDegreeSymbolWhenNan === true) {
        this.updateUnitTextVisibility(numberValue);
      }
    }
    onDisplayUnitChanged(displayUnit) {
      const value2 = this.value.get();
      if (!displayUnit || !value2.unit.canConvert(displayUnit)) {
        displayUnit = value2.unit;
      }
      const numberValue = value2.asUnit(displayUnit);
      this.updateNumberText(numberValue);
      this.updateUnitText(numberValue, displayUnit);
      this.updateUnitTextVisibility(numberValue);
    }
    updateNumberText(numberValue) {
      let numberText = this.props.formatter(numberValue);
      if (this.props.use360 !== false && parseFloat(numberText) === 0) {
        numberText = this.props.formatter(360);
      }
      this.numberText.set(numberText);
    }
    updateUnitText(numberValue, displayUnit) {
      _BearingDisplay2.unitTextCache[0] = "";
      _BearingDisplay2.unitTextCache[1] = "";
      this.unitFormatter(_BearingDisplay2.unitTextCache, displayUnit, numberValue);
      this.unitTextBig.set(_BearingDisplay2.unitTextCache[0]);
      this.unitTextSmall.set(_BearingDisplay2.unitTextCache[1]);
    }
    updateUnitTextVisibility(numberValue) {
      if (this.props.hideDegreeSymbolWhenNan === true) {
        if (isNaN(numberValue)) {
          this.unitTextBigDisplay.set("none");
          this.unitTextSmallDisplay.set("none");
          return;
        }
      }
      this.unitTextBigDisplay.set(this.unitTextBig.get() === "" ? "none" : "");
      this.unitTextSmallDisplay.set(this.unitTextSmall.get() === "" ? "none" : "");
    }
    render() {
      var _a;
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", { class: (_a = this.props.class) != null ? _a : "", style: "white-space: nowrap;" }, /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("span", { class: "bearing-num" }, this.numberText), /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("span", { class: "bearing-unit", style: { display: this.unitTextBigDisplay } }, this.unitTextBig), /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("span", { class: "bearing-unit-small", style: { display: this.unitTextSmallDisplay } }, this.unitTextSmall));
    }
  };
  _BearingDisplay.DEFAULT_UNIT_FORMATTER = (out, unit) => {
    out[0] = "\xB0";
    out[1] = unit.isMagnetic() ? "" : "T";
  };
  _BearingDisplay.unitTextCache = ["", ""];
  class Input extends GamepadUiComponent {
    constructor() {
      var _a, _b;
      super(...arguments);
      this.uuid = import_msfs_sdk.UUID.GenerateUuid();
      this.inputRef = this.gamepadUiComponentRef;
      this.model = this.props.model || import_msfs_sdk.Subject.create(import_msfs_sdk.SubscribableUtils.toSubscribable(this.props.value || "", true).get());
      this.internalInputManager = new InternalInputManager(InternalInputActions);
      this.dispatchFocusOutEvent = this._dispatchFocusOutEvent.bind(this);
      this.setValueFromOS = this._setValueFromOS.bind(this);
      this.onKeyDown = this._onKeyDown.bind(this);
      this.onKeyUp = this._onKeyUp.bind(this);
      this.onKeyPress = this._onKeyPress.bind(this);
      this.onInput = this._onInput.bind(this);
      this.align = this.props.align || "left";
      this.debounce = new import_msfs_sdk.DebounceTimer();
      this.reloadLocalisation = this._reloadLocalisation.bind(this);
      this._isFocused = import_msfs_sdk.Subject.create(false);
      this.isFocused = this._isFocused;
      this.focusSubscription = this._isFocused.sub((focus) => {
        if (focus) {
          this.onFocusIn();
        } else {
          this.onFocusOut();
        }
      });
      this.placeholderKey = import_msfs_sdk.SubscribableUtils.toSubscribable((_a = this.props.placeholder) != null ? _a : "", true);
      this.placeholderShown = import_msfs_sdk.Subject.create(true);
      this.placeholderTranslation = import_msfs_sdk.Subject.create(this.placeholderKey.get());
      this.hidePlaceholderOnFocus = (_b = this.props.hidePlaceholderOnFocus) != null ? _b : false;
      this.subs = [];
    }
    _reloadLocalisation() {
      this.placeholderTranslation.notify();
    }
    _onKeyDown(event) {
      var _a, _b;
      (_b = (_a = this.props).onKeyDown) == null || _b.call(_a, event);
    }
    _onKeyUp(event) {
      var _a, _b;
      (_b = (_a = this.props).onKeyUp) == null || _b.call(_a, event);
    }
    _onKeyPress(event) {
      var _a, _b;
      const keyCode = event.keyCode || event.which;
      (_b = (_a = this.props).onKeyPress) == null || _b.call(_a, event);
      if (event.defaultPrevented) {
        return;
      }
      if (this.props.charFilter && !this.props.charFilter(String.fromCharCode(keyCode))) {
        event.preventDefault();
        return;
      }
    }
    _onInput() {
      var _a;
      this.debounce.schedule(() => {
        const value2 = this.inputRef.instance.value;
        if (value2 === this.model.get()) {
          return;
        }
        this.model.set(value2);
      }, (_a = this.props.debounceDuration) != null ? _a : 0);
    }
    onInputUpdated(value2) {
      var _a, _b;
      this.inputRef.instance.value = value2;
      (_b = (_a = this.props).onInput) == null || _b.call(_a, this.inputRef.instance);
      if (!this.hidePlaceholderOnFocus && value2.length === 0) {
        this.placeholderShown.set(true);
      }
    }
    onFocusIn() {
      var _a, _b;
      Coherent.trigger("FOCUS_INPUT_FIELD", {
        title: "Title",
        description: "",
        default_text: "",
        is_numeric: this.props.type === "number",
        is_efb: true
      });
      Coherent.on("mousePressOutsideView", this.dispatchFocusOutEvent);
      Coherent.on("SetInputTextFromOS", this.setValueFromOS);
      this.focusOutActionDestructor = this.internalInputManager.addInputAction(InternalInputAction.BACK, () => {
        this.dispatchFocusOutEvent();
        return true;
      });
      this.validateInputActionDestructor = this.internalInputManager.addInputAction(InternalInputAction.TEXTBOX_VALID, () => {
        var _a2, _b2;
        (_b2 = (_a2 = this.props).onValueValidated) == null || _b2.call(_a2, this.inputRef.instance.value);
        this.dispatchFocusOutEvent();
        return true;
      });
      if (this.hidePlaceholderOnFocus && this.inputRef.instance.value.length === 0) {
        this.placeholderShown.set(false);
      }
      (_b = (_a = this.props).onFocusIn) == null || _b.call(_a);
    }
    onFocusOut() {
      var _a, _b, _c, _d;
      (_a = this.focusOutActionDestructor) == null || _a.call(this);
      (_b = this.validateInputActionDestructor) == null || _b.call(this);
      Coherent.trigger("UNFOCUS_INPUT_FIELD", this.uuid);
      Coherent.off("mousePressOutsideView", this.dispatchFocusOutEvent);
      Coherent.off("SetInputTextFromOS", this.setValueFromOS);
      if (this.hidePlaceholderOnFocus && this.inputRef.instance.value.length === 0) {
        this.placeholderShown.set(true);
      }
      (_d = (_c = this.props).onFocusOut) == null || _d.call(_c);
    }
    value() {
      return this.model.get();
    }
    clearInput() {
      this.model.set("");
    }
    focus() {
      const inputInstance = this.inputRef.getOrDefault();
      if (inputInstance !== null) {
        inputInstance.focus();
      }
    }
    blur() {
      const inputInstance = this.inputRef.getOrDefault();
      if (inputInstance !== null) {
        inputInstance.blur();
      }
    }
    _dispatchFocusOutEvent() {
      const inputInstance = this.inputRef.getOrDefault();
      if (inputInstance !== null) {
        inputInstance.blur();
        inputInstance.dispatchEvent(new InputEvent("focusout"));
      }
    }
    _setValueFromOS(text) {
      var _a, _b;
      const inputInstance = this.inputRef.getOrDefault();
      if (inputInstance !== null) {
        inputInstance.value = text;
        inputInstance.dispatchEvent(new InputEvent("change"));
        inputInstance.dispatchEvent(new InputEvent("input"));
        inputInstance.dispatchEvent(new InputEvent("submit"));
        (_b = (_a = this.props).onValueValidated) == null || _b.call(_a, text);
        this.dispatchFocusOutEvent();
      }
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("input", {
        id: this.uuid,
        ref: this.inputRef,
        type: this.props.type,
        class: {
          [`align-${this.align}`]: this.align !== "left"
        },
        placeholder: import_msfs_sdk.MappedSubject.create(([placeholderShown, placeholderKey]) => {
          return placeholderShown ? Utils.Translate(placeholderKey) : "";
        }, this.placeholderShown, this.placeholderKey),
        disabled: this.props.disabled,
        value: import_msfs_sdk.SubscribableUtils.toSubscribable(this.props.model || this.props.value || "", true).get()
      });
    }
    onAfterRender(node) {
      super.onAfterRender(node);
      this.subs.push(this.model.sub((value2) => {
        this.onInputUpdated(value2);
      }, true), this.placeholderKey.sub((key) => {
        this.placeholderTranslation.set(key);
      }, true));
      this.inputRef.instance.addEventListener("focus", () => this._isFocused.set(true));
      this.inputRef.instance.addEventListener("focusout", () => this._isFocused.set(false));
      this.inputRef.instance.addEventListener("input", this.onInput);
      this.inputRef.instance.addEventListener("keydown", this.onKeyDown);
      this.inputRef.instance.addEventListener("keyup", this.onKeyUp);
      this.inputRef.instance.addEventListener("keypress", this.onKeyPress);
      Coherent.on("RELOAD_LOCALISATION", this.reloadLocalisation);
      if (this.props.focusOnInit) {
        this.focus();
      }
    }
    destroy() {
      var _a;
      this.subs.forEach((s) => s.destroy());
      this.focusSubscription.destroy();
      (_a = this.focusOutActionDestructor) == null || _a.call(this);
      if (this._isFocused.get()) {
        Coherent.trigger("UNFOCUS_INPUT_FIELD", this.uuid);
        Coherent.off("mousePressOutsideView", this.dispatchFocusOutEvent);
        Coherent.off("SetInputTextFromOS", this.setValueFromOS);
      }
      this.inputRef.instance.removeEventListener("keydown", this.onKeyDown);
      this.inputRef.instance.removeEventListener("keyup", this.onKeyUp);
      this.inputRef.instance.removeEventListener("keypress", this.onKeyPress);
      this.inputRef.instance.removeEventListener("input", this.onInput);
      Coherent.off("RELOAD_LOCALISATION", this.reloadLocalisation);
      super.destroy();
    }
  }
  var addIconPath = "coui://html_ui/efb_ui/efb_os/Assets/icons/NoMargin/Close.svg";
  class TextBox extends GamepadUiComponent {
    constructor() {
      var _a, _b;
      super(...arguments);
      this.subscriptions = [];
      this.inputRef = import_msfs_sdk.FSComponent.createRef();
      this.model = this.props.model || import_msfs_sdk.Subject.create(import_msfs_sdk.SubscribableUtils.toSubscribable(this.props.value || "", true).get());
      this.hideDeleteTextButton = import_msfs_sdk.Subject.create(true);
      this.onDelete = this._onDelete.bind(this);
      this.onmousedown = (e) => {
        e.preventDefault();
        if (!this.inputRef.instance.isFocused.get()) {
          this.inputRef.instance.focus();
        }
      };
      this.prefix = import_msfs_sdk.SubscribableUtils.toSubscribable(this.props.prefix || "", true);
      this.suffix = import_msfs_sdk.SubscribableUtils.toSubscribable(this.props.suffix || "", true);
      this.showPrefix = import_msfs_sdk.SubscribableUtils.toSubscribable((_a = this.props.showPrefix) != null ? _a : true, true);
      this.showSuffix = import_msfs_sdk.SubscribableUtils.toSubscribable((_b = this.props.showSuffix) != null ? _b : true, true);
      this.prefixRef = import_msfs_sdk.FSComponent.createRef();
      this.suffixRef = import_msfs_sdk.FSComponent.createRef();
      this.showPrefixOrSuffixMapFunction = ([value2, show]) => {
        return !show || value2.toString().length === 0;
      };
    }
    _onDelete(event) {
      var _a, _b;
      event.preventDefault();
      this.hideDeleteTextButton.set(true);
      this.inputRef.instance.clearInput();
      (_b = (_a = this.props).onDelete) == null || _b.call(_a);
      if (this.props.focusOnClear) {
        this.inputRef.instance.focus();
      }
    }
    onInput(input) {
      var _a, _b;
      (_b = (_a = this.props).onInput) == null || _b.call(_a, input);
      if (this.props.showDeleteIcon) {
        this.hideDeleteTextButton.set(input.value.trim().length === 0);
      }
    }
    onFocusIn() {
      var _a, _b;
      (_b = (_a = this.props).onFocusIn) == null || _b.call(_a);
      this.gamepadUiComponentRef.instance.classList.add("textbox--focused");
    }
    onFocusOut() {
      var _a, _b;
      (_b = (_a = this.props).onFocusOut) == null || _b.call(_a);
      this.gamepadUiComponentRef.instance.classList.remove("textbox--focused");
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", { ref: this.gamepadUiComponentRef, class: "textbox" }, /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", { class: "disabled-layer" }), /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", {
        ref: this.prefixRef,
        class: {
          prefix: true,
          "prefix--hidden": import_msfs_sdk.MappedSubject.create(this.prefix, this.showPrefix).map(this.showPrefixOrSuffixMapFunction)
        }
      }), /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(Input, {
        ref: this.inputRef,
        type: "text",
        align: this.props.align,
        model: this.model,
        placeholder: this.props.placeholder,
        disabled: this.props.disabled,
        hidePlaceholderOnFocus: this.props.hidePlaceholderOnFocus,
        focusOnInit: this.props.focusOnInit,
        onFocusIn: this.onFocusIn.bind(this),
        onFocusOut: this.onFocusOut.bind(this),
        onInput: this.onInput.bind(this),
        onValueValidated: this.props.onValueValidated,
        debounceDuration: this.props.debounceDuration,
        onKeyDown: this.props.onKeyDown,
        onKeyUp: this.props.onKeyUp,
        onKeyPress: this.props.onKeyPress,
        charFilter: this.props.charFilter
      }), /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", {
        ref: this.suffixRef,
        class: {
          suffix: true,
          "suffix--hidden": import_msfs_sdk.MappedSubject.create(this.suffix, this.showSuffix).map(this.showPrefixOrSuffixMapFunction)
        }
      }), this.props.showDeleteIcon && /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(IconButton, {
        class: mergeClassProp("delete-text-button", { hide: this.hideDeleteTextButton }),
        iconPath: addIconPath,
        callback: this.onDelete
      }));
    }
    onAfterRender(node) {
      super.onAfterRender(node);
      const prefixSuffixCb = (reference) => {
        let previousNode = null;
        return (value2) => {
          if (previousNode) {
            import_msfs_sdk.FSComponent.shallowDestroy(previousNode);
            const instance = previousNode.instance;
            if (instance && instance instanceof import_msfs_sdk.DisplayComponent) {
              instance.destroy();
            }
            previousNode = null;
          }
          if (typeof value2 === "string") {
            reference.instance.innerText = value2;
          } else if (typeof value2 === "object" && isVNode(value2)) {
            previousNode = value2;
            reference.instance.innerHTML = "";
            import_msfs_sdk.FSComponent.render(value2, reference.instance);
          } else {
            reference.instance.innerText = value2;
          }
        };
      };
      this.subscriptions.push(this.prefix.sub(prefixSuffixCb(this.prefixRef), true), this.suffix.sub(prefixSuffixCb(this.suffixRef), true));
      this.gamepadUiComponentRef.instance.addEventListener("mousedown", this.onmousedown);
    }
    destroy() {
      this.gamepadUiComponentRef.instance.removeEventListener("mousedown", this.onmousedown);
      this.subscriptions.forEach((s) => s.destroy());
      super.destroy();
    }
  }
  var _UnitBox = class _UnitBox2 extends GamepadUiComponent {
    constructor() {
      var _a, _b;
      super(...arguments);
      this.valueNumber = this.props.value;
      this.unit = import_msfs_sdk.SubscribableUtils.toSubscribable((_a = this.props.unit) != null ? _a : null, true);
      this.showUnitSuffix = import_msfs_sdk.SubscribableUtils.toSubscribable((_b = this.props.showSuffix) != null ? _b : true, true);
      this.textValue = import_msfs_sdk.Subject.create("0");
      this.formattedTextValue = import_msfs_sdk.Subject.create("0");
      this.subs = [];
      this.canUpdateDisplay = true;
      this.suffixSmall = import_msfs_sdk.Subject.create("");
      this.suffixBig = import_msfs_sdk.Subject.create("");
    }
    static createDefaultUnitTextMap() {
      const originalMap = UnitFormatter.getUnitTextMap();
      const map = {};
      for (const family in originalMap) {
        const nameMap = map[family] = {};
        const originalNameMap = originalMap[family];
        for (const name in originalNameMap) {
          const text = nameMap[name] = ["", ""];
          const originalText = originalNameMap[name];
          if (originalText[0].startsWith("\xB0")) {
            text[0] = "\xB0";
            text[1] = originalText.substring(1);
          } else {
            text[1] = originalText;
          }
        }
      }
      return map;
    }
    setValue(value2, displayUnit) {
      var _a;
      if (!displayUnit || !value2.unit.canConvert(displayUnit)) {
        displayUnit = value2.unit;
      }
      let numberValue = value2.asUnit(displayUnit);
      if (this.props.min && numberValue < this.props.min.asUnit(displayUnit)) {
        numberValue = this.props.min.asUnit(displayUnit);
      }
      if (this.props.max && numberValue > this.props.max.asUnit(displayUnit)) {
        numberValue = this.props.max.asUnit(displayUnit);
      }
      if (numberValue >= 9999999) {
        this.textValue.set("9999999");
        return;
      }
      const numberText = import_msfs_sdk.NumberFormatter.create(__spreadValues2({
        nanString: "0"
      }, (_a = this.props.numberFormatterOptions) != null ? _a : {}))(numberValue);
      if (numberText.includes(".")) {
        const dotPos = numberText.indexOf(".");
        this.textValue.set(numberText.substring(0, dotPos + 3));
      } else {
        this.textValue.set(this.textValue.get().includes(".") ? `${numberText}.` : numberText);
      }
      const unitTexts = _UnitBox2.DEFAULT_UNIT_FORMATTER(displayUnit);
      if (unitTexts === null) {
        this.suffixSmall.set("");
        this.suffixBig.set("");
        return;
      }
      this.suffixSmall.set(unitTexts[0]);
      this.suffixBig.set(unitTexts[1]);
    }
    updateDisplay() {
      var _a, _b;
      (_b = (_a = this.props).onFocusOut) == null || _b.call(_a);
      if (this.canUpdateDisplay) {
        this.formattedTextValue.set(this.textValue.get());
      }
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", {
        ref: this.gamepadUiComponentRef,
        class: { unitbox: true, "unitbox--disabled": this.props.disabled || false }
      }, /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(TextBox, {
        align: "right",
        showDeleteIcon: this.props.showDeleteIcon || false,
        customDeleteIcon: this.props.customDeleteIcon,
        focusOnClear: this.props.focusOnClear,
        onDelete: this.props.onDelete,
        model: this.formattedTextValue,
        placeholder: this.props.placeholder,
        hidePlaceholderOnFocus: this.props.hidePlaceholderOnFocus,
        disabled: this.props.disabled,
        focusOnInit: this.props.focusOnInit,
        onFocusIn: this.props.onFocusIn,
        onFocusOut: this.updateDisplay.bind(this),
        onInput: this.props.onInput,
        onKeyPress: this.props.onKeyPress,
        charFilter: (char) => char >= "0" && char <= "9" || [",", ".", "-"].includes(char),
        suffix: /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent(import_msfs_sdk.FSComponent.Fragment, null, /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("span", null, this.suffixSmall), /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("span", null, this.suffixBig)),
        showSuffix: this.showUnitSuffix
      }));
    }
    onAfterRender(node) {
      super.onAfterRender(node);
      this.subs.push(this.formattedTextValue.sub((value2) => {
        value2 = value2.replace(",", ".").replace(/\.+$/, "");
        let displayUnit = this.unit.get();
        if (!displayUnit || !this.valueNumber.get().unit.canConvert(displayUnit)) {
          displayUnit = this.valueNumber.get().unit;
        }
        const unitValue = displayUnit.convertTo(Number(value2), this.valueNumber.get().unit);
        this.canUpdateDisplay = false;
        this.valueNumber.set(unitValue);
        this.canUpdateDisplay = true;
      }), this.valueNumber.sub((value2) => {
        this.setValue(value2, this.unit.get());
        this.updateDisplay();
      }, true), this.unit.sub((unit) => {
        this.setValue(this.valueNumber.get(), unit);
        this.updateDisplay();
      }, true));
    }
    destroy() {
      this.subs.forEach((s) => s.destroy());
      super.destroy();
    }
  };
  _UnitBox.DEFAULT_UNIT_TEXT_MAP = _UnitBox.createDefaultUnitTextMap();
  _UnitBox.DEFAULT_UNIT_FORMATTER = (unit) => {
    var _a;
    const text = (_a = _UnitBox.DEFAULT_UNIT_TEXT_MAP[unit.family]) == null ? void 0 : _a[unit.name];
    if (text) {
      return text;
    }
    return null;
  };
  var MapShim = (function() {
    if (typeof Map !== "undefined") {
      return Map;
    }
    function getIndex(arr, key) {
      var result = -1;
      arr.some(function(entry, index2) {
        if (entry[0] === key) {
          result = index2;
          return true;
        }
        return false;
      });
      return result;
    }
    return (function() {
      function class_1() {
        this.__entries__ = [];
      }
      Object.defineProperty(class_1.prototype, "size", {
        get: function() {
          return this.__entries__.length;
        },
        enumerable: true,
        configurable: true
      });
      class_1.prototype.get = function(key) {
        var index2 = getIndex(this.__entries__, key);
        var entry = this.__entries__[index2];
        return entry && entry[1];
      };
      class_1.prototype.set = function(key, value2) {
        var index2 = getIndex(this.__entries__, key);
        if (~index2) {
          this.__entries__[index2][1] = value2;
        } else {
          this.__entries__.push([key, value2]);
        }
      };
      class_1.prototype.delete = function(key) {
        var entries = this.__entries__;
        var index2 = getIndex(entries, key);
        if (~index2) {
          entries.splice(index2, 1);
        }
      };
      class_1.prototype.has = function(key) {
        return !!~getIndex(this.__entries__, key);
      };
      class_1.prototype.clear = function() {
        this.__entries__.splice(0);
      };
      class_1.prototype.forEach = function(callback, ctx) {
        if (ctx === void 0) {
          ctx = null;
        }
        for (var _i = 0, _a = this.__entries__; _i < _a.length; _i++) {
          var entry = _a[_i];
          callback.call(ctx, entry[1], entry[0]);
        }
      };
      return class_1;
    })();
  })();
  var isBrowser = typeof window !== "undefined" && typeof document !== "undefined" && window.document === document;
  var global$1 = (function() {
    if (typeof global !== "undefined" && global.Math === Math) {
      return global;
    }
    if (typeof self !== "undefined" && self.Math === Math) {
      return self;
    }
    if (typeof window !== "undefined" && window.Math === Math) {
      return window;
    }
    return Function("return this")();
  })();
  var requestAnimationFrame$1 = (function() {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame.bind(global$1);
    }
    return function(callback) {
      return setTimeout(function() {
        return callback(Date.now());
      }, 1e3 / 60);
    };
  })();
  var trailingTimeout = 2;
  function throttle(callback, delay) {
    var leadingCall = false, trailingCall = false, lastCallTime = 0;
    function resolvePending() {
      if (leadingCall) {
        leadingCall = false;
        callback();
      }
      if (trailingCall) {
        proxy();
      }
    }
    function timeoutCallback() {
      requestAnimationFrame$1(resolvePending);
    }
    function proxy() {
      var timeStamp = Date.now();
      if (leadingCall) {
        if (timeStamp - lastCallTime < trailingTimeout) {
          return;
        }
        trailingCall = true;
      } else {
        leadingCall = true;
        trailingCall = false;
        setTimeout(timeoutCallback, delay);
      }
      lastCallTime = timeStamp;
    }
    return proxy;
  }
  var REFRESH_DELAY = 20;
  var transitionKeys = ["top", "right", "bottom", "left", "width", "height", "size", "weight"];
  var mutationObserverSupported = typeof MutationObserver !== "undefined";
  var ResizeObserverController = (function() {
    function ResizeObserverController2() {
      this.connected_ = false;
      this.mutationEventsAdded_ = false;
      this.mutationsObserver_ = null;
      this.observers_ = [];
      this.onTransitionEnd_ = this.onTransitionEnd_.bind(this);
      this.refresh = throttle(this.refresh.bind(this), REFRESH_DELAY);
    }
    ResizeObserverController2.prototype.addObserver = function(observer) {
      if (!~this.observers_.indexOf(observer)) {
        this.observers_.push(observer);
      }
      if (!this.connected_) {
        this.connect_();
      }
    };
    ResizeObserverController2.prototype.removeObserver = function(observer) {
      var observers2 = this.observers_;
      var index2 = observers2.indexOf(observer);
      if (~index2) {
        observers2.splice(index2, 1);
      }
      if (!observers2.length && this.connected_) {
        this.disconnect_();
      }
    };
    ResizeObserverController2.prototype.refresh = function() {
      var changesDetected = this.updateObservers_();
      if (changesDetected) {
        this.refresh();
      }
    };
    ResizeObserverController2.prototype.updateObservers_ = function() {
      var activeObservers = this.observers_.filter(function(observer) {
        return observer.gatherActive(), observer.hasActive();
      });
      activeObservers.forEach(function(observer) {
        return observer.broadcastActive();
      });
      return activeObservers.length > 0;
    };
    ResizeObserverController2.prototype.connect_ = function() {
      if (!isBrowser || this.connected_) {
        return;
      }
      document.addEventListener("transitionend", this.onTransitionEnd_);
      window.addEventListener("resize", this.refresh);
      if (mutationObserverSupported) {
        this.mutationsObserver_ = new MutationObserver(this.refresh);
        this.mutationsObserver_.observe(document, {
          attributes: true,
          childList: true,
          characterData: true,
          subtree: true
        });
      } else {
        document.addEventListener("DOMSubtreeModified", this.refresh);
        this.mutationEventsAdded_ = true;
      }
      this.connected_ = true;
    };
    ResizeObserverController2.prototype.disconnect_ = function() {
      if (!isBrowser || !this.connected_) {
        return;
      }
      document.removeEventListener("transitionend", this.onTransitionEnd_);
      window.removeEventListener("resize", this.refresh);
      if (this.mutationsObserver_) {
        this.mutationsObserver_.disconnect();
      }
      if (this.mutationEventsAdded_) {
        document.removeEventListener("DOMSubtreeModified", this.refresh);
      }
      this.mutationsObserver_ = null;
      this.mutationEventsAdded_ = false;
      this.connected_ = false;
    };
    ResizeObserverController2.prototype.onTransitionEnd_ = function(_a) {
      var _b = _a.propertyName, propertyName = _b === void 0 ? "" : _b;
      var isReflowProperty = transitionKeys.some(function(key) {
        return !!~propertyName.indexOf(key);
      });
      if (isReflowProperty) {
        this.refresh();
      }
    };
    ResizeObserverController2.getInstance = function() {
      if (!this.instance_) {
        this.instance_ = new ResizeObserverController2();
      }
      return this.instance_;
    };
    ResizeObserverController2.instance_ = null;
    return ResizeObserverController2;
  })();
  var defineConfigurable = function(target, props) {
    for (var _i = 0, _a = Object.keys(props); _i < _a.length; _i++) {
      var key = _a[_i];
      Object.defineProperty(target, key, {
        value: props[key],
        enumerable: false,
        writable: false,
        configurable: true
      });
    }
    return target;
  };
  var getWindowOf = function(target) {
    var ownerGlobal = target && target.ownerDocument && target.ownerDocument.defaultView;
    return ownerGlobal || global$1;
  };
  var emptyRect = createRectInit(0, 0, 0, 0);
  function toFloat(value2) {
    return parseFloat(value2) || 0;
  }
  function getBordersSize(styles) {
    var positions = [];
    for (var _i = 1; _i < arguments.length; _i++) {
      positions[_i - 1] = arguments[_i];
    }
    return positions.reduce(function(size, position) {
      var value2 = styles["border-" + position + "-width"];
      return size + toFloat(value2);
    }, 0);
  }
  function getPaddings(styles) {
    var positions = ["top", "right", "bottom", "left"];
    var paddings = {};
    for (var _i = 0, positions_1 = positions; _i < positions_1.length; _i++) {
      var position = positions_1[_i];
      var value2 = styles["padding-" + position];
      paddings[position] = toFloat(value2);
    }
    return paddings;
  }
  function getSVGContentRect(target) {
    var bbox = target.getBBox();
    return createRectInit(0, 0, bbox.width, bbox.height);
  }
  function getHTMLElementContentRect(target) {
    var { clientWidth, clientHeight } = target;
    if (!clientWidth && !clientHeight) {
      return emptyRect;
    }
    var styles = getWindowOf(target).getComputedStyle(target);
    var paddings = getPaddings(styles);
    var horizPad = paddings.left + paddings.right;
    var vertPad = paddings.top + paddings.bottom;
    var width = toFloat(styles.width), height = toFloat(styles.height);
    if (styles.boxSizing === "border-box") {
      if (Math.round(width + horizPad) !== clientWidth) {
        width -= getBordersSize(styles, "left", "right") + horizPad;
      }
      if (Math.round(height + vertPad) !== clientHeight) {
        height -= getBordersSize(styles, "top", "bottom") + vertPad;
      }
    }
    if (!isDocumentElement(target)) {
      var vertScrollbar = Math.round(width + horizPad) - clientWidth;
      var horizScrollbar = Math.round(height + vertPad) - clientHeight;
      if (Math.abs(vertScrollbar) !== 1) {
        width -= vertScrollbar;
      }
      if (Math.abs(horizScrollbar) !== 1) {
        height -= horizScrollbar;
      }
    }
    return createRectInit(paddings.left, paddings.top, width, height);
  }
  var isSVGGraphicsElement = (function() {
    if (typeof SVGGraphicsElement !== "undefined") {
      return function(target) {
        return target instanceof getWindowOf(target).SVGGraphicsElement;
      };
    }
    return function(target) {
      return target instanceof getWindowOf(target).SVGElement && typeof target.getBBox === "function";
    };
  })();
  function isDocumentElement(target) {
    return target === getWindowOf(target).document.documentElement;
  }
  function getContentRect(target) {
    if (!isBrowser) {
      return emptyRect;
    }
    if (isSVGGraphicsElement(target)) {
      return getSVGContentRect(target);
    }
    return getHTMLElementContentRect(target);
  }
  function createReadOnlyRect(_a) {
    var { x, y, width, height } = _a;
    var Constr = typeof DOMRectReadOnly !== "undefined" ? DOMRectReadOnly : Object;
    var rect = Object.create(Constr.prototype);
    defineConfigurable(rect, {
      x,
      y,
      width,
      height,
      top: y,
      right: x + width,
      bottom: height + y,
      left: x
    });
    return rect;
  }
  function createRectInit(x, y, width, height) {
    return { x, y, width, height };
  }
  var ResizeObservation = (function() {
    function ResizeObservation2(target) {
      this.broadcastWidth = 0;
      this.broadcastHeight = 0;
      this.contentRect_ = createRectInit(0, 0, 0, 0);
      this.target = target;
    }
    ResizeObservation2.prototype.isActive = function() {
      var rect = getContentRect(this.target);
      this.contentRect_ = rect;
      return rect.width !== this.broadcastWidth || rect.height !== this.broadcastHeight;
    };
    ResizeObservation2.prototype.broadcastRect = function() {
      var rect = this.contentRect_;
      this.broadcastWidth = rect.width;
      this.broadcastHeight = rect.height;
      return rect;
    };
    return ResizeObservation2;
  })();
  var ResizeObserverEntry = /* @__PURE__ */ (function() {
    function ResizeObserverEntry2(target, rectInit) {
      var contentRect = createReadOnlyRect(rectInit);
      defineConfigurable(this, { target, contentRect });
    }
    return ResizeObserverEntry2;
  })();
  var ResizeObserverSPI = (function() {
    function ResizeObserverSPI2(callback, controller, callbackCtx) {
      this.activeObservations_ = [];
      this.observations_ = new MapShim();
      if (typeof callback !== "function") {
        throw new TypeError("The callback provided as parameter 1 is not a function.");
      }
      this.callback_ = callback;
      this.controller_ = controller;
      this.callbackCtx_ = callbackCtx;
    }
    ResizeObserverSPI2.prototype.observe = function(target) {
      if (!arguments.length) {
        throw new TypeError("1 argument required, but only 0 present.");
      }
      if (typeof Element === "undefined" || !(Element instanceof Object)) {
        return;
      }
      if (!(target instanceof getWindowOf(target).Element)) {
        throw new TypeError('parameter 1 is not of type "Element".');
      }
      var observations = this.observations_;
      if (observations.has(target)) {
        return;
      }
      observations.set(target, new ResizeObservation(target));
      this.controller_.addObserver(this);
      this.controller_.refresh();
    };
    ResizeObserverSPI2.prototype.unobserve = function(target) {
      if (!arguments.length) {
        throw new TypeError("1 argument required, but only 0 present.");
      }
      if (typeof Element === "undefined" || !(Element instanceof Object)) {
        return;
      }
      if (!(target instanceof getWindowOf(target).Element)) {
        throw new TypeError('parameter 1 is not of type "Element".');
      }
      var observations = this.observations_;
      if (!observations.has(target)) {
        return;
      }
      observations.delete(target);
      if (!observations.size) {
        this.controller_.removeObserver(this);
      }
    };
    ResizeObserverSPI2.prototype.disconnect = function() {
      this.clearActive();
      this.observations_.clear();
      this.controller_.removeObserver(this);
    };
    ResizeObserverSPI2.prototype.gatherActive = function() {
      var _this = this;
      this.clearActive();
      this.observations_.forEach(function(observation) {
        if (observation.isActive()) {
          _this.activeObservations_.push(observation);
        }
      });
    };
    ResizeObserverSPI2.prototype.broadcastActive = function() {
      if (!this.hasActive()) {
        return;
      }
      var ctx = this.callbackCtx_;
      var entries = this.activeObservations_.map(function(observation) {
        return new ResizeObserverEntry(observation.target, observation.broadcastRect());
      });
      this.callback_.call(ctx, entries, ctx);
      this.clearActive();
    };
    ResizeObserverSPI2.prototype.clearActive = function() {
      this.activeObservations_.splice(0);
    };
    ResizeObserverSPI2.prototype.hasActive = function() {
      return this.activeObservations_.length > 0;
    };
    return ResizeObserverSPI2;
  })();
  var observers = typeof WeakMap !== "undefined" ? /* @__PURE__ */ new WeakMap() : new MapShim();
  var ResizeObserver = /* @__PURE__ */ (function() {
    function ResizeObserver2(callback) {
      if (!(this instanceof ResizeObserver2)) {
        throw new TypeError("Cannot call a class as a function.");
      }
      if (!arguments.length) {
        throw new TypeError("1 argument required, but only 0 present.");
      }
      var controller = ResizeObserverController.getInstance();
      var observer = new ResizeObserverSPI(callback, controller, this);
      observers.set(this, observer);
    }
    return ResizeObserver2;
  })();
  [
    "observe",
    "unobserve",
    "disconnect"
  ].forEach(function(method) {
    ResizeObserver.prototype[method] = function() {
      var _a;
      return (_a = observers.get(this))[method].apply(_a, arguments);
    };
  });
  var index = (function() {
    if (typeof global$1.ResizeObserver !== "undefined") {
      return global$1.ResizeObserver;
    }
    return ResizeObserver;
  })();
  var _NumberUnitDisplay = class _NumberUnitDisplay2 extends import_msfs_sdk.AbstractNumberUnitDisplay {
    constructor() {
      var _a, _b;
      super(...arguments);
      this.formatter = (_a = this.props.formatter) != null ? _a : import_msfs_sdk.NumberFormatter.create({
        precision: 0.01,
        maxDigits: 5,
        forceDecimalZeroes: false,
        nanString: "0"
      });
      this.unitFormatter = (_b = this.props.unitFormatter) != null ? _b : _NumberUnitDisplay2.DEFAULT_UNIT_FORMATTER;
      this.unitTextBigDisplay = import_msfs_sdk.Subject.create("");
      this.unitTextSmallDisplay = import_msfs_sdk.Subject.create("");
      this.numberText = import_msfs_sdk.Subject.create("");
      this.unitTextBig = import_msfs_sdk.Subject.create("");
      this.unitTextSmall = import_msfs_sdk.Subject.create("");
    }
    onValueChanged(value2) {
      this.updateDisplay(value2, this.displayUnit.get());
    }
    onDisplayUnitChanged(displayUnit) {
      this.updateDisplay(this.value.get(), displayUnit);
    }
    updateDisplay(value2, displayUnit) {
      if (!displayUnit || !value2.unit.canConvert(displayUnit)) {
        displayUnit = value2.unit;
      }
      const numberValue = value2.asUnit(displayUnit);
      const numberText = this.formatter(numberValue);
      this.numberText.set(numberText);
      _NumberUnitDisplay2.unitTextCache[0] = "";
      _NumberUnitDisplay2.unitTextCache[1] = "";
      this.unitFormatter(_NumberUnitDisplay2.unitTextCache, displayUnit, numberValue);
      this.unitTextBig.set(_NumberUnitDisplay2.unitTextCache[0]);
      this.unitTextSmall.set(_NumberUnitDisplay2.unitTextCache[1]);
      this.updateUnitTextVisibility(numberValue, _NumberUnitDisplay2.unitTextCache[0], _NumberUnitDisplay2.unitTextCache[1]);
    }
    updateUnitTextVisibility(numberValue, unitTextBig, unitTextSmall) {
      if (this.props.hideUnitWhenNaN === true && isNaN(numberValue)) {
        this.unitTextBigDisplay.set("none");
        this.unitTextSmallDisplay.set("none");
        return;
      }
      this.unitTextBigDisplay.set(unitTextBig === "" ? "none" : "");
      this.unitTextSmallDisplay.set(unitTextSmall === "" ? "none" : "");
    }
    static createDefaultUnitTextMap() {
      const originalMap = UnitFormatter.getUnitTextMap();
      const map = {};
      for (const family in originalMap) {
        const nameMap = map[family] = {};
        const originalNameMap = originalMap[family];
        for (const name in originalNameMap) {
          const text = nameMap[name] = ["", ""];
          const originalText = originalNameMap[name];
          if (originalText[0] === "\xB0") {
            text[0] = "\xB0";
            text[1] = originalText.substring(1);
          } else {
            text[1] = originalText;
          }
        }
      }
      return map;
    }
    render() {
      var _a;
      return /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("div", { class: (_a = this.props.class) != null ? _a : "", style: "white-space: nowrap;" }, /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("span", { class: "numberunit-num" }, this.numberText), /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("span", { class: "numberunit-unit-big", style: { display: this.unitTextBigDisplay } }, this.unitTextBig), /* @__PURE__ */ import_msfs_sdk.FSComponent.buildComponent("span", { class: "numberunit-unit-small", style: { display: this.unitTextSmallDisplay } }, this.unitTextSmall));
    }
  };
  _NumberUnitDisplay.DEFAULT_UNIT_TEXT_MAP = _NumberUnitDisplay.createDefaultUnitTextMap();
  _NumberUnitDisplay.DEFAULT_UNIT_FORMATTER = (out, unit) => {
    var _a;
    const text = (_a = _NumberUnitDisplay.DEFAULT_UNIT_TEXT_MAP[unit.family]) == null ? void 0 : _a[unit.name];
    if (text) {
      out[0] = text[0];
      out[1] = text[1];
    }
  };
  _NumberUnitDisplay.unitTextCache = ["", ""];
  var _FacilitySearchUtils = class _FacilitySearchUtils2 {
    constructor(bus) {
      this.facilityLoader = null;
      this.position = new import_msfs_sdk.GeoPoint(0, 0);
      bus.getSubscriber().on("gps-position").handle((pos) => {
        this.position.set(pos.lat, pos.long);
      });
      this.facilityLoader = new import_msfs_sdk.FacilityLoader(import_msfs_sdk.FacilityRepository.getRepository(bus));
    }
    static getSearchUtils(bus) {
      var _a;
      return (_a = _FacilitySearchUtils2.INSTANCE) != null ? _a : _FacilitySearchUtils2.INSTANCE = new _FacilitySearchUtils2(bus);
    }
    orderByIdentsAndDistance(a, b) {
      const aIdent = a.icaoStruct.ident.trim();
      const bIdent = b.icaoStruct.ident.trim();
      if (aIdent === bIdent) {
        const aDist = this.position.distance(a.lat, a.lon);
        const bDist = this.position.distance(b.lat, b.lon);
        return aDist - bDist;
      } else {
        return aIdent.localeCompare(bIdent);
      }
    }
    async loadFacilities(ident, facilitySearchType = import_msfs_sdk.FacilitySearchType.All, excludeTerminalFacilities = true) {
      if (this.facilityLoader === null) {
        return Promise.resolve([]);
      }
      const icaos = await this.facilityLoader.searchByIdentWithIcaoStructs(facilitySearchType, ident, 15);
      const facilities = (await this.facilityLoader.getFacilities(icaos)).filter((fac) => fac !== null && (!excludeTerminalFacilities || fac.icaoStruct.airport.length === 0));
      facilities.sort((a, b) => this.orderByIdentsAndDistance(a, b));
      return facilities;
    }
  };
  _FacilitySearchUtils.INSTANCE = null;
  var _SearchFacilityHistoryManager = class _SearchFacilityHistoryManager2 {
    constructor() {
      this.MAX_ITEMS_STORED = 5;
      this.storedICAOs = import_msfs_sdk.ArraySubject.create();
      this.loadICAOsFromStorage();
    }
    loadICAOsFromStorage() {
      let arrayICAOs = [];
      const stringICAOs = import_msfs_sdk.DataStore.get(_SearchFacilityHistoryManager2.DATASTORE_KEY);
      if (stringICAOs === void 0 || typeof stringICAOs !== "string") {
        this.storedICAOs.set(arrayICAOs);
        return;
      }
      try {
        arrayICAOs = JSON.parse(stringICAOs);
      } catch (e) {
        console.error("JSON failed, impossible to parse : ", stringICAOs);
      }
      this.storedICAOs.set(arrayICAOs);
    }
    saveICAOsToStorage() {
      const stringICAOs = JSON.stringify(this.storedICAOs.getArray());
      import_msfs_sdk.DataStore.set(_SearchFacilityHistoryManager2.DATASTORE_KEY, stringICAOs);
    }
    mostRecentSearch(icao) {
      const foundIndex = this.storedICAOs.getArray().findIndex((storedIcao) => storedIcao === icao);
      if (foundIndex !== -1) {
        this.storedICAOs.removeAt(foundIndex);
      }
      this.storedICAOs.insert(icao, 0);
      while (this.storedICAOs.length > this.MAX_ITEMS_STORED) {
        this.storedICAOs.removeAt(this.MAX_ITEMS_STORED);
      }
      this.saveICAOsToStorage();
    }
    getStoredICAOs(input, max_items = this.MAX_ITEMS_STORED) {
      this.loadICAOsFromStorage();
      return this.storedICAOs.getArray().filter((icao) => import_msfs_sdk.ICAO.getIdent(icao).startsWith(input.toUpperCase())).slice(0, max_items);
    }
  };
  _SearchFacilityHistoryManager.DATASTORE_KEY = "efb.search-bar-history";
  var _OnboardingManager = class _OnboardingManager2 {
    constructor() {
      this.isStarted = false;
      this.stepIndex = 0;
      this.steps = [];
    }
    static getManager() {
      var _a;
      return (_a = _OnboardingManager2.INSTANCE) != null ? _a : _OnboardingManager2.INSTANCE = new _OnboardingManager2();
    }
    bindContainer(containerRef) {
      _OnboardingManager2.getManager().containerRef = containerRef;
    }
    start(onboarding) {
      const onboardingManager = _OnboardingManager2.getManager();
      onboardingManager.steps = onboarding.steps.map((step) => {
        return __spreadProps(__spreadValues2({}, step), { actions: [...step.actions] });
      });
      if (!onboardingManager.containerRef) {
        console.warn("Onboarding container not bound");
        return;
      }
      if (!onboardingManager.steps.length) {
        console.warn("No onboarding steps provided");
        return;
      }
      if (onboardingManager.isStarted) {
        console.warn("Onboarding already started");
        return;
      }
      onboardingManager.stepIndex = 0;
      onboardingManager.isStarted = true;
      onboardingManager.onFinish = onboarding.onFinish;
      onboardingManager.steps[onboardingManager.stepIndex].actions.unshift({
        key: "@fs-base-efb,TT:EFB.COMMON.QUICK_TOUR_AROUND",
        callback: () => {
          onboardingManager.next();
        }
      }, {
        key: "@fs-base-efb,TT:EFB.COMMON.SKIP",
        callback: () => {
          onboardingManager.stop();
        }
      });
      onboardingManager.containerRef.instance.show();
      onboardingManager.containerRef.instance.setStep(onboardingManager.steps[onboardingManager.stepIndex]);
      onboardingManager.stepIndex++;
      return;
    }
    next() {
      var _a;
      const onboardingManager = _OnboardingManager2.getManager();
      if (!onboardingManager.isStarted) {
        console.warn("Onboarding not started. You should call start method first");
        return;
      }
      if (onboardingManager.stepIndex >= onboardingManager.steps.length) {
        onboardingManager.stop();
        return;
      }
      onboardingManager.steps[onboardingManager.stepIndex].actions.unshift({
        key: "@fs-base-efb,TT:EFB.COMMON.NEXT",
        callback: () => {
          onboardingManager.next();
        }
      });
      (_a = onboardingManager.containerRef) == null || _a.instance.setStep(onboardingManager.steps[onboardingManager.stepIndex]);
      onboardingManager.stepIndex++;
      return;
    }
    stop() {
      var _a, _b;
      const onboardingManager = _OnboardingManager2.getManager();
      onboardingManager.isStarted = false;
      onboardingManager.steps = [];
      (_a = onboardingManager.containerRef) == null || _a.instance.hide();
      (_b = onboardingManager.onFinish) == null || _b.call(onboardingManager);
    }
  };
  _OnboardingManager.INSTANCE = void 0;
  var _EfbCommonSettingsManager = class _EfbCommonSettingsManager2 extends import_msfs_sdk.DefaultUserSettingManager {
    constructor() {
      super(...arguments);
      this.debounceTimer = new import_msfs_sdk.DebounceTimer();
      this.ignoredForceSaveSettingKeys = [];
    }
    onSettingValueChanged(entry, value2) {
      super.onSettingValueChanged(entry, value2);
      if (!this.ignoredForceSaveSettingKeys.includes(entry.setting.definition.name)) {
        this.debounceTimer.schedule(() => {
          Coherent.trigger("EFB_PERSISTENT_SETTINGS_SAVE");
        }, _EfbCommonSettingsManager2.debounceTimeout);
      }
    }
  };
  _EfbCommonSettingsManager.debounceTimeout = 5e3;
  var EfbCommonSettingsManager = _EfbCommonSettingsManager;
  var UnitsNavAngleSettingMode = /* @__PURE__ */ ((UnitsNavAngleSettingMode2) => {
    UnitsNavAngleSettingMode2["Magnetic"] = "magnetic";
    UnitsNavAngleSettingMode2["True"] = "true";
    return UnitsNavAngleSettingMode2;
  })(UnitsNavAngleSettingMode || {});
  var UnitsSpeedSettingMode = /* @__PURE__ */ ((UnitsSpeedSettingMode2) => {
    UnitsSpeedSettingMode2["Nautical"] = "KTS";
    UnitsSpeedSettingMode2["Metric"] = "KPH";
    return UnitsSpeedSettingMode2;
  })(UnitsSpeedSettingMode || {});
  var UnitsDistanceSettingMode = /* @__PURE__ */ ((UnitsDistanceSettingMode2) => {
    UnitsDistanceSettingMode2["Nautical"] = "NM";
    UnitsDistanceSettingMode2["Metric"] = "KM";
    return UnitsDistanceSettingMode2;
  })(UnitsDistanceSettingMode || {});
  var UnitsSmallDistanceSettingMode = /* @__PURE__ */ ((UnitsSmallDistanceSettingMode2) => {
    UnitsSmallDistanceSettingMode2["Feet"] = "FT";
    UnitsSmallDistanceSettingMode2["Meters"] = "M";
    return UnitsSmallDistanceSettingMode2;
  })(UnitsSmallDistanceSettingMode || {});
  var UnitsAltitudeSettingMode = /* @__PURE__ */ ((UnitsAltitudeSettingMode2) => {
    UnitsAltitudeSettingMode2["Feet"] = "FT";
    UnitsAltitudeSettingMode2["Meters"] = "M";
    return UnitsAltitudeSettingMode2;
  })(UnitsAltitudeSettingMode || {});
  var UnitsWeightSettingMode = /* @__PURE__ */ ((UnitsWeightSettingMode2) => {
    UnitsWeightSettingMode2["Pounds"] = "LBS";
    UnitsWeightSettingMode2["Kilograms"] = "KG";
    return UnitsWeightSettingMode2;
  })(UnitsWeightSettingMode || {});
  var UnitsVolumeSettingMode = /* @__PURE__ */ ((UnitsVolumeSettingMode2) => {
    UnitsVolumeSettingMode2["Gallons"] = "GAL US";
    UnitsVolumeSettingMode2["Liters"] = "L";
    return UnitsVolumeSettingMode2;
  })(UnitsVolumeSettingMode || {});
  var UnitsTemperatureSettingMode = /* @__PURE__ */ ((UnitsTemperatureSettingMode2) => {
    UnitsTemperatureSettingMode2["Fahrenheit"] = "\xB0F";
    UnitsTemperatureSettingMode2["Celsius"] = "\xB0C";
    return UnitsTemperatureSettingMode2;
  })(UnitsTemperatureSettingMode || {});
  var UnitsTimeSettingMode = /* @__PURE__ */ ((UnitsTimeSettingMode2) => {
    UnitsTimeSettingMode2["Local12"] = "local-12";
    UnitsTimeSettingMode2["Local24"] = "local-24";
    return UnitsTimeSettingMode2;
  })(UnitsTimeSettingMode || {});
  var _UnitsSettingsManager = class _UnitsSettingsManager2 extends EfbCommonSettingsManager {
    constructor(bus, settingsDefs) {
      super(bus, settingsDefs, true);
      this.navAngleUnitsSub = import_msfs_sdk.Subject.create(_UnitsSettingsManager2.MAGNETIC_BEARING);
      this.navAngleUnits = this.navAngleUnitsSub;
      this.timeUnitsSub = import_msfs_sdk.Subject.create("local-12");
      this._timeUnits = this.timeUnitsSub;
      this.areSubscribablesInit = false;
      this.areSubscribablesInit = true;
      for (const entry of this.settings.values()) {
        this.updateUnitsSubjects(entry.setting.definition.name, entry.setting.value);
      }
    }
    onSettingValueChanged(entry, value2) {
      if (this.areSubscribablesInit) {
        this.updateUnitsSubjects(entry.setting.definition.name, value2);
      }
      super.onSettingValueChanged(entry, value2);
    }
    checkLoadedValues() {
      checkUserSetting(this.getSetting("unitsNavAngle"), UnitsNavAngleSettingMode);
      checkUserSetting(this.getSetting("unitsSpeed"), UnitsSpeedSettingMode);
      checkUserSetting(this.getSetting("unitsDistance"), UnitsDistanceSettingMode);
      checkUserSetting(this.getSetting("unitsAltitude"), UnitsAltitudeSettingMode);
      checkUserSetting(this.getSetting("unitsSmallDistance"), UnitsSmallDistanceSettingMode);
      checkUserSetting(this.getSetting("unitsWeight"), UnitsWeightSettingMode);
      checkUserSetting(this.getSetting("unitsVolume"), UnitsVolumeSettingMode);
      checkUserSetting(this.getSetting("unitsTemperature"), UnitsTemperatureSettingMode);
      checkUserSetting(this.getSetting("unitsTime"), UnitsTimeSettingMode);
    }
    updateUnitsSubjects(settingName, value2) {
      switch (settingName) {
        case "unitsNavAngle":
          this.navAngleUnitsSub.set(value2 === "true" ? _UnitsSettingsManager2.TRUE_BEARING : _UnitsSettingsManager2.MAGNETIC_BEARING);
          break;
        case "unitsTime":
          this.timeUnitsSub.set(value2);
          break;
        case "unitsDistance":
          this.getSetting("unitsSmallDistance").set(value2 === "NM" ? "FT" : "M");
      }
    }
    getSettingUnitType(settingName) {
      const setting = this.getSetting(settingName);
      return setting.map((settingValue) => {
        var _a;
        return (_a = UnitTypesMap[settingValue]) != null ? _a : UnitTypesMap[setting.definition.defaultValue];
      });
    }
  };
  _UnitsSettingsManager.TRUE_BEARING = import_msfs_sdk.BasicNavAngleUnit.create(false);
  _UnitsSettingsManager.MAGNETIC_BEARING = import_msfs_sdk.BasicNavAngleUnit.create(true);
  var UnitTypesMap = {
    KTS: import_msfs_sdk.UnitType.KNOT,
    KPH: import_msfs_sdk.UnitType.KPH,
    NM: import_msfs_sdk.UnitType.NMILE,
    KM: import_msfs_sdk.UnitType.KILOMETER,
    FT: import_msfs_sdk.UnitType.FOOT,
    M: import_msfs_sdk.UnitType.METER,
    LBS: import_msfs_sdk.UnitType.POUND,
    KG: import_msfs_sdk.UnitType.KILOGRAM,
    "GAL US": import_msfs_sdk.UnitType.GALLON,
    L: import_msfs_sdk.UnitType.LITER,
    "\xB0C": import_msfs_sdk.UnitType.CELSIUS,
    "\xB0F": import_msfs_sdk.UnitType.FAHRENHEIT
  };
  var import_msfs_sdk2 = __toESM(require_msfs_sdk_shim());
  var BRIDGE = "http://127.0.0.1:8090";
  var VERSION = "0.7.0";
  function remoteLog(msg) {
    try {
      fetch(`${BRIDGE}/api/lido/log`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ msg: String(msg).slice(0, 2e3), v: VERSION }) }).catch(() => {
      });
    } catch (e) {
    }
  }
  function startLink(onStatus) {
    const w = window;
    if (!w.__cockpitEfbLink) {
      w.__cockpitEfbLink = new BridgeLink();
      w.__cockpitEfbLink.start();
      remoteLog(`Sim-Modul geladen (${typeof location !== "undefined" ? location.href : "?"})`);
    }
    if (onStatus) {
      w.__cockpitEfbLink.onStatus = onStatus;
      onStatus(w.__cockpitEfbLink.status);
    }
    return w.__cockpitEfbLink;
  }
  class SimCharts {
    constructor() {
      __publicField(this, "listener", null);
      __publicField(this, "ready", null);
      __publicField(this, "seq", null);
      __publicField(this, "pending", /* @__PURE__ */ new Map());
      __publicField(this, "views", /* @__PURE__ */ new Map());
    }
    init() {
      if (this.ready)
        return this.ready;
      this.ready = new Promise((resolve) => {
        this.listener = RegisterViewListener("JS_LISTENER_CHARTS", () => {
          const l = this.listener;
          l.on("SendChartIndex", (id, data) => this.done(id, data));
          l.on("SendChartIndexError", (id, code) => this.fail(id, code));
          l.on("SendChartPages", (id, data) => this.done(id, data));
          l.on("SendChartPagesError", (id, code) => this.fail(id, code));
          l.on("SendLiveViewName", (guid, name, url) => {
            const f = this.views.get(guid);
            if (f)
              f(name, url);
          });
          l.on("SendLiveViewError", (guid, code, url) => {
            const f = this.views.get(guid);
            if (f)
              f("", url, code);
          });
          resolve(l);
        });
      });
      try {
        RegisterViewListener("JS_LISTENER_ATOMIC", () => {
          this.seq = window.AtomicSequence;
        });
      } catch (e) {
      }
      return this.ready;
    }
    nextId() {
      try {
        if (this.seq && this.seq.getNext)
          return this.seq.getNext();
      } catch (e) {
      }
      return Math.floor(1e9 + Math.random() * 1e9);
    }
    done(id, data) {
      const p = this.pending.get(id);
      if (p) {
        this.pending.delete(id);
        p.resolve(data);
      }
    }
    fail(id, code) {
      const p = this.pending.get(id);
      if (p) {
        this.pending.delete(id);
        p.reject(new Error(`Chart-Fehler ${code}`));
      }
    }
    request(method, ...args) {
      return this.init().then((l) => new Promise((resolve, reject) => {
        const id = this.nextId();
        const timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error("Keine Antwort vom Sim"));
        }, 15e3);
        this.pending.set(id, { resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        }, reject: (e) => {
          clearTimeout(timer);
          reject(e);
        } });
        l.call(method, id, ...args);
      }));
    }
    index(icao) {
      const icaoValue = { __Type: "JS_ICAO", type: "A", region: "", airport: "", ident: icao.toUpperCase() };
      return this.request("GET_CHARTS_INDEX", icaoValue, "LIDO");
    }
    pages(guid) {
      return this.request("GET_CHART_PAGES", guid);
    }
    async liveView(pageUrl) {
      const l = await this.init();
      const viewId = await l.call("CREATE_CHART_VIEW");
      try {
        return await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("Zeit\xFCberschreitung beim Laden des Bildes")), 2e4);
          this.views.set(viewId, (name, url, err) => {
            if (url !== pageUrl)
              return;
            clearTimeout(timer);
            if (err || !name)
              reject(new Error(`Bildfehler ${err || 0}`));
            else
              resolve(name);
          });
          l.call("SET_CHART_VIEW_URL", viewId, pageUrl);
        });
      } finally {
        setTimeout(() => {
          this.views.delete(viewId);
          try {
            l.call("DESTROY_CHART_VIEW", viewId);
          } catch (e) {
          }
        }, 15e3);
      }
    }
  }
  class BridgeLink {
    constructor() {
      __publicField(this, "status", "Starte \u2026");
      __publicField(this, "onStatus", () => {
      });
      __publicField(this, "busy", false);
      __publicField(this, "charts", new SimCharts());
      __publicField(this, "dataListener", null);
    }
    start() {
      setInterval(() => this.poll(), 700);
    }
    setStatus(s) {
      if (s !== this.status) {
        this.status = s;
        this.onStatus(s);
      }
    }
    async poll() {
      if (this.busy)
        return;
      this.busy = true;
      try {
        const r = await fetch(`${BRIDGE}/api/lido/poll?v=${VERSION}`);
        const d = await r.json();
        this.setStatus("Verbunden mit der PC-Br\xFCcke");
        if (Array.isArray(d.fbwFailures))
          this.sendFailures(d.fbwFailures);
        for (const job of d.jobs)
          await this.run(job);
      } catch (e) {
        this.setStatus("PC-Br\xFCcke nicht erreichbar \u2013 l\xE4uft start.bat?");
      } finally {
        this.busy = false;
      }
    }
    async post(body) {
      await fetch(`${BRIDGE}/api/lido/result`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    async run(job) {
      try {
        if (job.type === "index") {
          const data = await this.charts.index(job.icao);
          await this.post({ id: job.id, ok: true, data: JSON.parse(JSON.stringify(data)) });
        } else if (job.type === "pages") {
          const data = await this.charts.pages(job.guid);
          await this.post({ id: job.id, ok: true, data: JSON.parse(JSON.stringify(data)) });
        } else if (job.type === "image") {
          const info = await this.renderImage(job.id, job.url);
          await this.post({ id: job.id, ok: true, data: __spreadValues({ rawDone: true }, info) });
        }
      } catch (e) {
        await this.post({ id: job.id, ok: false, error: `${e && e.message ? e.message : e}` });
      }
    }
    async renderImage(jobId, url) {
      const src = await this.charts.liveView(url);
      const im = new Image();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Bild l\xE4dt nicht (Zeit\xFCberschreitung)")), 2e4);
        im.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        im.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Bild konnte im Sim nicht geladen werden"));
        };
        im.src = src;
      });
      const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
      if (!(w > 0 && h > 0))
        throw new Error(`Bildgr\xF6\xDFe ${w}x${h}`);
      remoteLog(`Bild geladen: ${w}x${h}, sende Streifen \u2026`);
      const sh = 256;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = sh;
      const ctx = c.getContext("2d");
      let nonWhite = 0;
      for (let y = 0; y < h; y += sh) {
        const rows = Math.min(sh, h - y);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, sh);
        ctx.drawImage(im, 0, y, w, rows, 0, 0, w, rows);
        let img;
        try {
          img = ctx.getImageData(0, 0, w, rows);
        } catch (e) {
          throw new Error(`getImageData: ${e}`);
        }
        const rgba = img.data, rgb = new Uint8Array(w * rows * 3);
        for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
          const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
          rgb[j] = r;
          rgb[j + 1] = g;
          rgb[j + 2] = b;
          if (r < 245 || g < 245 || b < 245)
            nonWhite++;
        }
        const resp = await fetch(`${BRIDGE}/api/lido/stripe?job=${jobId}&y=${y}&w=${w}&rows=${rows}&h=${h}`, { method: "POST", body: rgb });
        if (!resp.ok)
          throw new Error(`Streifen abgelehnt (${resp.status})`);
      }
      remoteLog(`Bild gesendet: ${nonWhite} nicht-wei\xDFe Pixel`);
      if (nonWhite === 0)
        throw new Error("Das Bild ist komplett wei\xDF/leer \u2013 das Canvas hat die Live-View nicht gezeichnet");
      return { w, h, nonWhite };
    }
    sendFailures(active) {
      try {
        Coherent.call("COMM_BUS_WASM_CALLBACK", "FBW_FAILURE_UPDATE", JSON.stringify(active));
        if (!this.dataListener)
          this.dataListener = RegisterGenericDataListener();
        this.dataListener.send("EB_EVENTS", { packagedId: Math.floor(Math.random() * 1e9), data: [{ topic: "FBW_FAILURE_UPDATE", data: active }] });
      } catch (e) {
        this.setStatus(`St\xF6rungen konnten nicht gesendet werden: ${e}`);
      }
    }
  }
  var status = import_msfs_sdk2.Subject.create("Starte \u2026");
  startLink((s) => status.set(s));
  class CockpitLinkView extends AppView {
    render() {
      return /* @__PURE__ */ import_msfs_sdk2.FSComponent.buildComponent("div", {
        style: "padding: 40px; font-size: 26px; color: #e8ecef; background: #0b0f13; height: 100%; box-sizing: border-box;"
      }, /* @__PURE__ */ import_msfs_sdk2.FSComponent.buildComponent("div", {
        style: "font-size: 36px; margin-bottom: 20px;"
      }, "Cockpit EFB Link"), /* @__PURE__ */ import_msfs_sdk2.FSComponent.buildComponent("div", {
        style: "color: #3be26a;"
      }, status), /* @__PURE__ */ import_msfs_sdk2.FSComponent.buildComponent("div", {
        style: "margin-top: 22px; color: #8794a0; font-size: 20px; line-height: 1.4;"
      }, "Verbindet den Sim mit der PC-Br\xFCcke deines iPad-EFB (Lido-Charts, Systemst\xF6rungen). Die App arbeitet im Hintergrund, du musst sie nicht ge\xF6ffnet lassen."));
    }
  }
  class CockpitLinkApp extends App {
    constructor() {
      super(...arguments);
      __publicField(this, "BootMode", AppBootMode.HOT);
      __publicField(this, "SuspendMode", AppSuspendMode.SLEEP);
    }
    get name() {
      return "Cockpit EFB Link";
    }
    get internalName() {
      return "CockpitEfbLink";
    }
    get icon() {
      return "coui://html_ui/efb_ui/efb_apps/CockpitEfbLink/Assets/app-icon.svg";
    }
    async install() {
      try {
        this.efbSettingsManager.addAppToFavorites(this);
      } catch (e) {
        remoteLog(`Favorit nicht m\xF6glich: ${e}`);
      }
      remoteLog("App im EFB installiert");
    }
    render() {
      return /* @__PURE__ */ import_msfs_sdk2.FSComponent.buildComponent(CockpitLinkView, {
        bus: this.bus
      });
    }
  }
  try {
    Efb.use(CockpitLinkApp);
    remoteLog("App beim EFB angemeldet");
  } catch (e) {
    remoteLog(`Anmeldung beim EFB fehlgeschlagen: ${e}`);
  }
})();
