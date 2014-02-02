// Handlebar extension
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
var
__decodeURI = function () {
  var search = location.search.substring(1);
  return search ? JSON.parse('{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}',
         function(key, value) { return key===""?value:decodeURIComponent(value) }):{};
}, 
__encodeURI = function(obj, prefix) {
  var str = [];
  for(var p in obj) {
    var k = prefix ? prefix + "[" + p + "]" : p, v = obj[p];
    str.push(typeof v == "object" ?
      __encodeURI(v, k) :
      encodeURIComponent(k) + "=" + encodeURIComponent(v));
  }
  return str.join("&");
};

/* Make something awesome! */
$('#expandStories').click(function() {
        var newstate = $(this).attr('state') ^ 1,
            text = newstate ? "Collapse" : "Expand";
        if ( $(this).attr('state')==="0" ) {
            $('#grid').find('.panel-body div#collapse:not(.in)').collapse('show');
        }
        else {
            $('#grid').find('.panel-body div#collapse').collapse('hide');
        }

        $(this).html( text );

        $(this).attr('state',newstate)

});

$('#createStory').click(function() {
  $('#collapseComments').addClass('hidden');
  $('#storyComments').addClass('hidden');
  $('#storyEdit').addClass('hidden');    
  $('#storyCancel').removeClass('hidden');

  $('.not-edit').addClass('hidden');      
  $('.edit').removeClass('hidden');   
  
  $('#storyTitle').html('Create story');
  $('#storySubmit').html('Create')
});

$('.story').click(function() {
  $('#collapseComments').removeClass('hidden');
  $('#storyComments').removeClass('hidden');
  $('#storyEdit').removeClass('hidden');  
  $('#storyEdit').attr('state', 0)
  
  $('.not-edit').removeClass('hidden'); 
  $('.edit').addClass('hidden'); 
  
  $('#storySubmit').addClass('hidden');
  $('#storyCancel').addClass('hidden');
  
  $('#storyTitle').html('Story Title');

});

$('#storyEdit').click(function() {
  var newstate = $(this).attr('state') ^ 1,
      text = newstate ? "Cancel" : "Edit";
  $('#storyCancel').addClass('hidden');
  if ( $(this).attr('state')==="0" ) {
    $('.not-edit').addClass('hidden');      
    $('.edit').removeClass('hidden');   
    
    $('#storyTitle').html('Story Title');
    $('#storySubmit').html('Update')
  } else {
    $('.not-edit').removeClass('hidden');      
    $('.edit').addClass('hidden'); 
    
    $('#storyTitle').html('Story Title');
    $('#storySubmit').html('Create')
  }   

    
  $(this).html( text );
  $(this).attr('state',newstate)
});




// Init 
$('#nav').ready( function() {
  $('#nav').html(Handlebars.getTemplate('nav'));
});

routie({
  '/auth': function() {
    $('#content').html('');
    var code = StoryMap.cookie.__read('auth_code');
    if (code) {
      StoryMap.cookie.__erase('auth_code');
      StoryMap.oauth(code).done(function(){ routie('/projects') });
    } else {
      routie('');
    }
  },
  '/projects/:username?': function(username) {
    StoryMap.projects(username);
  },
  '/storymap:project': function() {
    StoryMap.projects();
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




