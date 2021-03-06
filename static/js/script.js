// Handlebar extensions

Handlebars.getTemplate = function(name) {
  if (Handlebars.templates === undefined || Handlebars.templates[name] === undefined) {
    NProgress.start();
    NProgress.inc();
    $.ajax({
      url : 'template/' + name + '.handlebars',
      success : function(data) {
        NProgress.inc();
        if (Handlebars.templates === undefined) {
          Handlebars.templates = {};
        }
        NProgress.inc();
        Handlebars.templates[name] = Handlebars.compile(data);
        NProgress.done();
      },
      async : false
    });
  }
  return Handlebars.templates[name];
};
Handlebars.registerHelper('if_odd', function(conditional, options) {
  if((conditional % 2) != 0) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});
Handlebars.registerHelper('ifvalue', function (conditional, options) {
  if (options.hash.value === conditional) {
    return options.fn(this)
  } else {
    return options.inverse(this);
  }
});
Handlebars.registerHelper('unlessvalue', function (conditional, options) {
  if (options.hash.value !== conditional) {
    return options.fn(this)
  } else {
    return options.inverse(this);
  }
});
Handlebars.registerHelper('ellipsis', function (text) {
  return text.length < 64 ? text : text.slice(0,64).trim()+'...';
});
Handlebars.registerHelper('date', function (date) {
  return new Date(date).toLocaleString();
});
Handlebars.registerPartial("story", Handlebars.getTemplate('story'));

// jQuery extensions
(function($) {
  $.fn.goTo = function() {
    $('html, body').animate({
        scrollTop: $(this).offset().top + 'px'
    }, 'fast');
    return this;
  }
})(jQuery);

$(document).on('page:fetch',   function() { NProgress.start(); });
$(document).on('page:change',  function() { NProgress.done(); });
$(document).on('page:restore', function() { NProgress.remove(); });
// Init 
$('#nav').ready( function() {
  $('#nav').html(Handlebars.getTemplate('nav'));
});

// Routing setup
routie({
  '/auth': function() {
    $('#content').html('');
    var code = StoryMap.util.cookie.__read('auth_code');
    if (code != null) {
      StoryMap.util.cookie.__erase('auth_code');
      StoryMap.oauth(code).done(function(){ routie('/projects') });
    } else {
      routie('');
    }
  },
  '/about' : function(){
    $('#content').removeClass('container-large');
    $('#content').html(Handlebars.getTemplate('usermanual'));
  },
  '/projects/:username?': function(username) {
    $('#content').html('');
    $('#content').removeClass('container-large');
    StoryMap.projects(username);
  },
  '/storymap/:user/repo/:project': function(user, project) {
    $('#content').addClass('container-large');
    StoryMap.issues(user, project);
  },
  '/logout' : function() {
    StoryMap.util.cookie.__erase('auth_code');
    StoryMap.util.cookie.__erase('access_token');
    StoryMap.util.cookie.__erase('clientid');
    $('#nav').html(Handlebars.getTemplate('nav'));
    window.location.href = "/";
  },
  '*': function() {
    $('#content').removeClass('container-large');
    if (StoryMap.util.cookie.__read('access_token')) {
      routie('/projects');
    } else {
      $('#content').html(Handlebars.getTemplate('login'));
      $('#loginbtn').click( function() {
        StoryMap.login();
      });
    }
  }
});