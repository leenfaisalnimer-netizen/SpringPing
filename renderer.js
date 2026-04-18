const avatarUpload      = document.getElementById('avatarUpload');
const avatarInput       = document.getElementById('avatarInput');
const avatarPreview     = document.getElementById('avatarPreview');
const avatarPlaceholder = document.getElementById('avatarPlaceholder');
const nameInput         = document.getElementById('nameInput');
const joinBtn           = document.getElementById('joinBtn');
const errorMsg          = document.getElementById('errorMsg');

let photoDataUrl = null;   


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
  joinBtn.disabled = !(nameOk && photoOk);
}
nameInput.addEventListener('input', validateForm);


// JOIN BUTTON HANDLER 
joinBtn.addEventListener('click', async () => {
  const name = nameInput.value.trim();
  if (!name || !photoDataUrl) return;

  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining...';

  try {
    // IPC 01  save the user in main.js
    await window.springping.initUser({ name, photo: photoDataUrl });
    sessionStorage.setItem('sp_user', JSON.stringify({ name, photo: photoDataUrl }));

    window.location.href = 'chat.html';
  } catch (err) {
    console.error(err);
    errorMsg.textContent = 'Could not join. Please try again.';
    joinBtn.disabled = false;
    joinBtn.textContent = 'Join';
  }
});
