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



// Intial loading of templates
$('#nav').ready( function() {
  $('#nav').html(Handlebars.getTemplate('nav'));
});




