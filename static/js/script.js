// Handlebar extension to load in template files
Handlebars.getTemplate = function(name) {
  if (Handlebars.templates === undefined || Handlebars.templates[name] === undefined) {
    $.ajax({
      url : 'template/' + name + '.handlebars',
      success : function(data) {
        if (Handlebars.templates === undefined) {
          Handlebars.templates = {};
        }
        Handlebars.templates[name] = Handlebars.compile(data);
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

// Init 
$('#nav').ready( function() {
  $('#nav').html(Handlebars.getTemplate('nav'));
});

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