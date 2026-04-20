const avatarUpload      = document.getElementById('avatarUpload');
const avatarInput       = document.getElementById('avatarInput');
const avatarPreview     = document.getElementById('avatarPreview');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');
const nameInput         = document.getElementById('nameInput');
const joinBtn           = document.getElementById('joinBtn');
const errorMsg          = document.getElementById('errorMsg');

//TODO (new) Room mode elements
const btnModeHost       = document.getElementById('btnModeHost');
const btnModeJoin       = document.getElementById('btnModeJoin');
const hostIpGroup       = document.getElementById('hostIpGroup');
const hostIpInput       = document.getElementById('hostIpInput');

let photoDataUrl = null;
let selectedMode = 'host';  //TODO (new) default mode is "Create Room"


// AVATAR UPLOAD HANDLER
avatarInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    errorMsg.textContent = 'Please select an image file.';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    photoDataUrl = e.target.result;
    avatarPreview.src = photoDataUrl;
    avatarPreview.style.display = 'block';
    avatarPlaceholder.style.display = 'none';
    errorMsg.textContent = '';
    validateForm();
  };
  reader.readAsDataURL(file);
});

// FORM VALIDATION
function validateForm() {
  const nameOk  = nameInput.value.trim().length > 0;
  const photoOk = !!photoDataUrl;

  // TODO (new) If "Join Room" is selected, the IP field must also be filled in
  const ipOk = selectedMode === 'host' || hostIpInput.value.trim().length > 0;

  joinBtn.disabled = !(nameOk && photoOk && ipOk);
}
nameInput.addEventListener('input', validateForm);


// TODO(new) MODE SELECTOR — Switch between "Create Room" and "Join Room"

btnModeHost.addEventListener('click', () => {
  selectedMode = 'host';
  btnModeHost.classList.add('active');
  btnModeJoin.classList.remove('active');
  hostIpGroup.style.display = 'none';    // hide the IP input
  joinBtn.textContent = 'Create & Join';
  validateForm();
});

btnModeJoin.addEventListener('click', () => {
  selectedMode = 'join';
  btnModeJoin.classList.add('active');
  btnModeHost.classList.remove('active');
  hostIpGroup.style.display = 'block';   // show the IP input
  joinBtn.textContent = 'Join Room';
  validateForm();
});

//TODO (new) Re-validate when the IP input changes
hostIpInput.addEventListener('input', validateForm);


//TODO JOIN BUTTON HANDLER
joinBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  if (!name || !photoDataUrl) return;

  joinBtn.disabled = true;
  joinBtn.textContent = 'Connecting...';  // TODO (new) updated text

  try {
    // IPC 01  save the user in main.js
    await window.springping.initUser({ name, photo: photoDataUrl });

    //TODO (new) Store the mode + optional host IP so chat.js can read them
    sessionStorage.setItem('sp_user', JSON.stringify({ name, photo: photoDataUrl }));
    sessionStorage.setItem('sp_mode', selectedMode);
    if (selectedMode === 'join') {
      sessionStorage.setItem('sp_host_ip', hostIpInput.value.trim());
    }

    window.location.href = 'chat.html';
  } catch (err) {
    console.error(err);
    errorMsg.textContent = 'Could not join. Please try again.';
    joinBtn.disabled = false;
    joinBtn.textContent = selectedMode === 'host' ? 'Create & Join' : 'Join Room';
  }
});

//TODO (new) Set the initial button text
joinBtn.textContent = 'Create & Join';
