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
    var code = StoryMap.cookie.__read('auth_code');
    if (code != null) {
      StoryMap.cookie.__erase('auth_code');
      StoryMap.oauth(code).done(function(){ routie('/projects') });
    } else {
      routie('');
    }
  },
  '/projects/:username?': function(username) {
    StoryMap.projects(username);
  },
  '/storymap/:user/repo/:project': function(user, project) {
    StoryMap.issues(user, project);
  },
  '*': function() {
    if (StoryMap.cookie.__read('access_token')) {
      routie('/projects');
    } else {
      $('#content').html(Handlebars.getTemplate('login'));
      $('#loginbtn').click( function() {
        StoryMap.login();
      });
    }
  }
});

$('.ss-container').shapeshift();

// Bootstrap Affix does not work for some reason so here's 
// our jury-rigged implementation:
// $(document).ready(function() {
//   $(window).scroll(function () {
//     if ($(window).scrollTop() > $('#navbar').height()) {
//       $('#story-map-headers').addClass('affix row');
//       $('#sprint-backlog').css('margin-top', $('#story-map-headers').height());
//     }

//     if ($(window).scrollTop() < $('#navbar').height() + 1) {
//       $('#story-map-headers').removeClass('affix row');
//       $('#sprint-backlog').css('margin-top', 0);
//     }
//   });
// });
