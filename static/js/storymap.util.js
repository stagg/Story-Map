(function() {

  if (typeof StoryMap === 'undefined') {
    window.StoryMap = {};
  }

  /**
    Generation of the storymap utility object that contains utility functions 
    used in and outside the StoryMap
    @namespace StoryMap.util
    @global 
  */
  window.StoryMap.util = {
    /**

      @method 
      @summary 
      @memberof StoryMap.util 
    */
    __generateId: function (length) {
      var 
        text = "",
        possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      for (var i=0; i < length; i++) {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return text;
    },
    /**

      @summary 
      @memberof StoryMap.util 
      @namespace StoryMap.util.cookie
    */
    cookie: {
      /**

      @method 
      @summary 
      @memberof StoryMap.util.cookie 
      */
      __create: function (name, value) {
        StoryMap.util.cookie.__erase(name);
        var date = new Date();
        date.setTime(date.getTime() + 360000); // +60 mins
        var expires = "; expires="+date.toGMTString();
        document.cookie = name + "=" + value + expires + "; path=/";
      },
      /**

      @method 
      @summary 
      @memberof StoryMap.util.cookie 
      */
      __read: function (name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1,c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
      },
      /**

      @method 
      @summary 
      @memberof StoryMap.util.cookie
      */
      __erase: function ( name ) {
        var date = new Date();
        date.setTime(date.getTime() - 86400000);
        document.cookie = name + "=; expires=" + date.toGMTString() + "; path=/";
      }
    },
    /**

      @summary 
      @memberof StoryMap.util 
      @namespace StoryMap.util.uri
    */
    uri:{
      /**

      @method 
      @summary 
      @memberof StoryMap.util.uri
      */
      __decode: function () {
          var search = location.search.substring(1);
          return search ? JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}',
                 function(key, value) { return key===""?value:decodeURIComponent(value) }):{};
      }, 
      /**

      @method 
      @summary 
      @memberof StoryMap.util.uri
      */
      __encode: function(obj, prefix) {
        var str = [];
        for(var p in obj) {
          var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
          str.push(typeof v == "object" ?
            StoryMap.uri.__encode(v, k) :
            encodeURIComponent(k) + "=" + encodeURIComponent(v));
        }
        return str.join("&");
      }
    },
  };

})();