(function () {
  'use strict';
  // Keep International Edition configuration, saves, and UI state separate
  // from the Chinese edition even though both are served from one origin.
  const prefix = 'wolf-en:';
  const proto = Storage.prototype;
  const getItem = proto.getItem;
  const setItem = proto.setItem;
  const removeItem = proto.removeItem;

  proto.getItem = function (key) {
    return getItem.call(this, this === window.localStorage ? prefix + key : key);
  };
  proto.setItem = function (key, value) {
    return setItem.call(this, this === window.localStorage ? prefix + key : key, value);
  };
  proto.removeItem = function (key) {
    return removeItem.call(this, this === window.localStorage ? prefix + key : key);
  };
})();
