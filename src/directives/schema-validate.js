angular.module('schemaForm').directive('schemaValidate', ['sfValidator', 'sfSelect', '$rootScope', function(sfValidator, sfSelect, $rootScope) {
  return {
    restrict: 'A',
    scope: false,
    // We want the link function to be *after* the input directives link function so we get access
    // the parsed value, ex. a number instead of a string
    priority: 500,
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {


      // We need the ngModelController on several places,
      // most notably for errors.
      // So we emit it up to the decorator directive so it can put it on scope.
      scope.$emit('schemaFormPropagateNgModelController', ngModel);

      var error = null;

      var getForm = function() {
        if (!form) {
          form = scope.$eval(attrs.schemaValidate);
        }
        return form;
      };
      var form   = getForm();
      if (form.copyValueTo) {
        ngModel.$viewChangeListeners.push(function() {
          var paths = form.copyValueTo;
          angular.forEach(paths, function(path) {
            sfSelect(path, scope.model, ngModel.$modelValue);
          });
        });
      }

      // Validate against the schema.

      var validate = function(viewValue) {
        form = getForm();
        //Still might be undefined
        if (!form) {
          return viewValue;
        }

        var result =  sfValidator.validate(form, viewValue);
        // Since we might have different tv4 errors we must clear all
        // errors that start with tv4-
        Object.keys(ngModel.$error)
              .filter(function(k) { return k.indexOf('tv4-') === 0; })
              .forEach(function(k) { ngModel.$setValidity(k, true); });

        // Trigger validation on all dependencies if any
        if (form.validationDependecies) {
          for (var i in form.validationDependecies) {
            var keys = form.key.slice();
            keys[form.key.length - 1] = form.validationDependecies[i];
            $rootScope.$broadcast('schemaForm.error.' + keys.join('.'), 'dummy', true);
          }
        }

        if (!result.valid) {
          // it is invalid, return undefined (no model update)
          ngModel.$setValidity('tv4-' + result.error.code, false);
          error = result.error;
          return undefined;
        } else if (form.customValidator) {
          var errorResult = form.customValidator(viewValue);

          if (errorResult) {
            if (errorResult.message) {
              if (!form.validationMessage) {
                form.validationMessage = {};
              }
              form.validationMessage[errorResult.code] = errorResult.message;
            }

            ngModel.$setDirty();
            ngModel.$setValidity(errorResult.code, false);
          }
        }

        return viewValue;
      };

      form.validate = function(){
        validate(ngModel.$modelValue);
        scope.$apply();
      };

      // Custom validators, parsers, formatters etc
      if (typeof form.ngModel === 'function') {
        form.ngModel(ngModel);
      }

      ['$parsers', '$viewChangeListeners', '$formatters'].forEach(function(attr) {
        if (form[attr] && ngModel[attr]) {
          form[attr].forEach(function(fn) {
            ngModel[attr].push(fn);
          });
        }
      });

      ['$validators', '$asyncValidators'].forEach(function(attr) {
        // Check if our version of angular has i, i.e. 1.3+
        if (form[attr] && ngModel[attr]) {
          angular.forEach(form[attr], function(fn, name) {
            ngModel[attr][name] = fn;
          });
        }
      });

      // Get in last of the parses so the parsed value has the correct type.
      // We don't use $validators since we like to set different errors depeding tv4 error codes
      ngModel.$parsers.push(validate);

      var funcName = function() {
        if (ngModel.$setDirty) {
          // Angular 1.3+
          ngModel.$setDirty();
          validate(ngModel.$modelValue);
        } else {
          // Angular 1.2
          ngModel.$setViewValue(ngModel.$viewValue);
        }

      };

      // Listen to an event so we can validate the input on request
      var eventNames = ngSchemaEventName(element);
      scope.$on(eventNames.all, funcName);
      if( eventNames.prefixedName ){
          scope.$on(eventNames.prefixedName, funcName);
      }


      scope.schemaError = function() {
        return error;
      };

    }
  };
}]);


function ngSchemaEventName(element){
      var eventName =  'schemaFormValidate';
      var eventNamePrefix = element.parents('form').attr('name');
      if( eventNamePrefix && $.trim(eventNamePrefix) != '' ){
          eventNamePrefix = eventNamePrefix + '-' + eventName;
      }
      return {
          'all':eventName+'All',
          'prefixedName':eventNamePrefix
      }
}