var 
  validState = StoryMap.util.cookie.__read('auth_state'),
  parameters = StoryMap.util.uri.__decode(),
  state = parameters.state,
  code = parameters.code;
  
if (state != 'undefined' && state === validState) {
  // Redirect to #auth
  StoryMap.util.cookie.__erase('auth_state');
  StoryMap.util.cookie.__create('auth_code', code);
  document.location.href = '/#/auth';
} else {
  document.location.href = '/';
}