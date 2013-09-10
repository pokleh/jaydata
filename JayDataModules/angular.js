﻿
Object.defineProperty($data.Entity.prototype, "_isNew", {
    get: function () {
        return !this.storeToken;
    }
});
Object.defineProperty($data.Entity.prototype, "_isDirty", {
    get: function () {
        return !this._isNew && this.changedProperties && this.changedProperties.length;
    }
});

var originalSave = $data.Entity.prototype.save;
var originalRemove = $data.Entity.prototype.remove;
var originalSaveChanges = $data.EntityContext.prototype.saveChanges;

var _getCacheKey = function (query) {
    var key = query.expression.getJSON();
    var hash = 0, i, charC;
    if (key.length == 0) return hash;
    for (i = 0; i < key.length; i++) {
        charC = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + charC;
        hash = hash & hash;
    }
    return hash;
}


angular.module('jaydata', ['ng', function ($provide) {

    $provide.factory('$data', function ($rootScope, $q) {
        var cache = {};

        $data.Entity.prototype.hasOwnProperty = function (propName) {
            var member;
            if (this.getType && this.getType().memberDefinitions) {
                if (member = this.getType().memberDefinitions['$' + propName]) {
                    return ("property" === member.kind) && member.enumerable;
                } else {
                    return false;
                }
            }
            return Object.prototype.hasOwnProperty.apply(this, arguments);
        }

        $data.Queryable.prototype.toLiveArray = function (cb, options) {
            var _this = this;
            options = options || {};

            var trace = this.toTraceString();
            var cacheKey = _getCacheKey(this); // trace.queryText || trace.sqlText + JSON.stringify(trace.params);

            if (cache[cacheKey]) {
                return cache[cacheKey];
            }

            var result = [];
            cache[cacheKey] = result;

            result.state = "inprogress";
            result.successHandlers = [];
            result.errorHandlers = [];

            
            if (cb && typeof cb === 'function') {
                chainOrFire(cb, "success");
            }

            function chainOrFire(cb, type) {
                if (!cb) return;
                var targetCbArr = type === "success" ? result.successHandlers : result.errorHandlers;
                if (result.state === "completed") {
                    cb(result);
                } else {
                    targetCbArr.push(cb);
                }
                return result;
            }

            result.then = result.success = function (cb) {
                return chainOrFire(cb, "success");
            };

            result.error = function (cb) {
                return result;
            };

            result.refresh = function (cb) {
                //result = [];
                result.length = 0;
                result.state = "inprogress";
                chainOrFire(cb, "success");
                _this.toArray({ success: result.resolve, error: result.reject });
                return result;
            }

            result.resolve = function (items) {
                result.state = "completed";
                items.forEach(function (item) {
                    result.push(item);
                });
                result.successHandlers.forEach(function (handler) {
                    handler(result);
                });
                if (!$rootScope.$$phase) $rootScope.$apply();
            }

            result.reject = function (err) {
                result.state = "failed";
                result.errorHandlers.forEach(function (handler) {
                    handler(err);
                });
                if (!$rootScope.$$phase) $rootScope.$apply();
            }

            this.toArray({ success: result.resolve, error: result.reject });

            return result;
        };

        $data.Entity.prototype.save = function () {
            var d = $q.defer();
            var _this = this;
            originalSave.call(_this).then(function () {
                cache = {};
                d.resolve(_this);
                if (!$rootScope.$$phase) $rootScope.$apply();
            }).fail(function (err) {
                d.reject(err);
                if (!$rootScope.$$phase) $rootScope.$apply();
            });

            return d.promise;
        }

        $data.Entity.prototype.remove = function () {
            var d = $q.defer();
            var _this = this;
            originalRemove.call(_this).then(function () {
                cache = {};
                d.resolve(_this);
                if (!$rootScope.$$phase) $rootScope.$apply();
            }).fail(function (err) {
                d.reject(err);
                if (!$rootScope.$$phase) $rootScope.$apply();
            });
            
            return d.promise;
        }

        $data.EntityContext.prototype.saveChanges = function () {
            var d = $q.defer();
            var _this = this;
            originalSaveChanges.call(_this).then(function (n) {
                cache = {};
                d.resolve(n);
                if (!$rootScope.$$phase) $rootScope.$apply();
            }).fail(function (err) {
                d.reject(err);
                if (!$rootScope.$$phase) $rootScope.$apply();
            });

            return d.promise;
        }

        return $data;
    });
}]);