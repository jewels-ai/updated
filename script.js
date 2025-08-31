const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');

const snapshotModal = document.getElementById('snapshot-modal');
const snapshotPreview = document.getElementById('snapshot-preview');
const infoModal = document.getElementById('info-modal');
const subcategoryButtons = document.getElementById('subcategory-buttons');
const jewelryOptions = document.getElementById('jewelry-options');

let earringImg = null;
let necklaceImg = null;
let tiaraImg = null;
let braceletImg = null;
let ringImg = null;

let lastSnapshotDataURL = '';
let currentType = '';
let smoothedFaceLandmarks = null;
let smoothedHandLandmarks = null;
let camera;
let currentCameraFacingMode = 'user'; // 'user' for front camera, 'environment' for back

// Utility function to load images with a Promise
async function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.error(`Failed to load image: ${src}`);
      resolve(null);
    };
    img.src = src;
  });
}

// Updated to handle all jewelry types
async function changeJewelry(type, src) {
  const img = await loadImage(src);
  if (!img) return;

  // Clear all previous jewelry images
  earringImg = null;
  necklaceImg = null;
  tiaraImg = null;
  braceletImg = null;
  ringImg = null;

  if (type.includes('earrings')) {
    earringImg = img;
  } else if (type.includes('necklaces')) {
    necklaceImg = img;
  } else if (type.includes('tiara')) {
    tiaraImg = img;
  } else if (type.includes('bracelet')) {
    braceletImg = img;
  } else if (type.includes('ring')) {
    ringImg = img;
  }
}

// Function to handle the main category buttons
function toggleCategory(category) {
  jewelryOptions.style.display = 'none';
  subcategoryButtons.style.display = 'none';
  currentType = category;

  const isAccessoryCategory = ['bracelet', 'ring'].includes(category);
  if (isAccessoryCategory) {
    // Hide subcategory buttons and show product options directly
    const jewelryCounts = {
      bracelet: 7,
      ring: 10,
    };
    const end = jewelryCounts[category] || 5;
    insertJewelryOptions(category, 'jewelry-options', 1, end);
    jewelryOptions.style.display = 'flex';
    // Automatically switch to the back camera for bracelets and rings
    startCamera('environment');
  } else {
    // Show subcategory buttons (Gold/Diamond) and a front camera
    subcategoryButtons.style.display = 'flex';
    startCamera('user');
  }
}

// Function to handle the subcategory buttons (Gold/Diamond)
function selectJewelryType(mainType, subType) {
  currentType = `${subType}_${mainType}`;
  subcategoryButtons.style.display = 'none';
  jewelryOptions.style.display = 'flex';
  
  earringImg = null;
  necklaceImg = null;

  const jewelryCounts = {
    gold_earrings: 16,
    gold_necklaces: 19,
    diamond_earrings: 9,
    diamond_necklaces: 6,
  };

  const end = jewelryCounts[currentType] || 15;
  insertJewelryOptions(currentType, 'jewelry-options', 1, end);
}

// This function remains the same
function insertJewelryOptions(type, containerId, startIndex, endIndex) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (let i = startIndex; i <= endIndex; i++) {
    const filename = `${type}${i}.png`;
    const btn = document.createElement('button');
    const img = document.createElement('img');
    img.src = `${type}/${filename}`;
    img.alt = `${type.replace('_', ' ')} ${i}`;
    btn.appendChild(img);
    btn.onclick = () => changeJewelry(type, `${type}/${filename}`);
    container.appendChild(btn);
  }
}

// MediaPipe Setup for Face and Hands
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});

hands.onResults((results) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        smoothedHandLandmarks = results.multiHandLandmarks;
    } else {
        smoothedHandLandmarks = null;
    }
});

faceMesh.onResults((results) => {
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const newLandmarks = results.multiFaceLandmarks[0];
    if (!smoothedFaceLandmarks) {
      smoothedFaceLandmarks = newLandmarks;
    } else {
      const smoothingFactor = 0.2;
      smoothedFaceLandmarks = smoothedFaceLandmarks.map((prev, i) => ({
        x: prev.x * (1 - smoothingFactor) + newLandmarks[i].x * smoothingFactor,
        y: prev.y * (1 - smoothingFactor) + newLandmarks[i].y * smoothingFactor,
        z: prev.z * (1 - smoothingFactor) + newLandmarks[i].z * smoothingFactor,
      }));
    }
  } else {
    smoothedFaceLandmarks = null;
  }
  drawJewelry(smoothedFaceLandmarks, smoothedHandLandmarks, canvasCtx);
});

// New camera function to start the video stream with a specific facing mode
async function startCamera(facingMode) {
    if (camera) {
        camera.stop();
    }

    camera = new Camera(videoElement, {
        onFrame: async () => {
            await faceMesh.send({ image: videoElement });
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720,
        facingMode: facingMode
    });
    camera.start();
}

document.addEventListener('DOMContentLoaded', (event) => {
    // Start with the front camera by default
    startCamera('user');
});

videoElement.addEventListener('loadedmetadata', () => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
});

// Drawing Functions - UPDATED
function drawJewelry(faceLandmarks, handLandmarks, ctx) {
  const earringScale = 0.07;
  const necklaceScale = 0.18;
  const braceletScale = 0.15;
  const ringScale = 0.05;
  // Adjust this value to change the default angle of the bracelet.
  // The value is in radians. For example, Math.PI / 2 is 90 degrees.
  const angleOffset = Math.PI / 2; 

  if (faceLandmarks) {
    const leftEarLandmark = faceLandmarks[132];
    const rightEarLandmark = faceLandmarks[361];
    const neckLandmark = faceLandmarks[152];
    const foreheadLandmark = faceLandmarks[10];

    const leftEarPos = {
      x: leftEarLandmark.x * canvasElement.width - 6,
      y: leftEarLandmark.y * canvasElement.height - 16,
    };
    const rightEarPos = {
      x: rightEarLandmark.x * canvasElement.width + 6,
      y: rightEarLandmark.y * canvasElement.height - 16,
    };
    const neckPos = {
      x: neckLandmark.x * canvasElement.width - 8,
      y: neckLandmark.y * canvasElement.height + 10,
    };

    if (earringImg) {
      const width = earringImg.width * earringScale;
      const height = earringImg.height * earringScale;
      ctx.drawImage(earringImg, leftEarPos.x - width / 2, leftEarPos.y, width, height);
      ctx.drawImage(earringImg, rightEarPos.x - width / 2, rightEarPos.y, width, height);
    }
    if (necklaceImg) {
      const width = necklaceImg.width * necklaceScale;
      const height = necklaceImg.height * necklaceScale;
      ctx.drawImage(necklaceImg, neckPos.x - width / 2, neckPos.y, width, height);
    }
  }

  if (handLandmarks) {
    handLandmarks.forEach(hand => {
      // Use wrist landmark and middle finger knuckle to calculate a stable angle
      const wristLandmark = hand[0];
      const middleFingerKnuckleLandmark = hand[9];

      const wristPos = {
        x: wristLandmark.x * canvasElement.width,
        y: wristLandmark.y * canvasElement.height,
      };
      
      const middleFingerKnucklePos = {
        x: middleFingerKnuckleLandmark.x * canvasElement.width,
        y: middleFingerKnuckleLandmark.y * canvasElement.height,
      };

      const ringFingerPos = {
        x: hand[14].x * canvasElement.width,
        y: hand[14].y * canvasElement.height,
      };

      // Calculate the angle of the hand in radians
      const angle = Math.atan2(middleFingerKnucklePos.y - wristPos.y, middleFingerKnucklePos.x - wristPos.x);

      if (braceletImg) {
        const width = braceletImg.width * braceletScale;
        const height = braceletImg.height * braceletScale;
        
        ctx.save();
        ctx.translate(wristPos.x, wristPos.y);
        ctx.rotate(angle + angleOffset); // Apply the rotation with the offset
        ctx.drawImage(braceletImg, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      
      if (ringImg) {
        const width = ringImg.width * ringScale;
        const height = ringImg.height * ringScale;
        ctx.drawImage(ringImg, ringFingerPos.x - width / 2, ringFingerPos.y - height / 2, width, height);
      }
    });
  }
}

// Snapshot & Modal Functions (no changes needed)
function takeSnapshot() {
  if (!smoothedFaceLandmarks && !smoothedHandLandmarks) {
    alert("Face or hand not detected. Please try again.");
    return;
  }

  const snapshotCanvas = document.createElement('canvas');
  const ctx = snapshotCanvas.getContext('2d');
  snapshotCanvas.width = videoElement.videoWidth;
  snapshotCanvas.height = videoElement.videoHeight;
  ctx.drawImage(videoElement, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  drawJewelry(smoothedFaceLandmarks, smoothedHandLandmarks, ctx);
  lastSnapshotDataURL = snapshotCanvas.toDataURL('image/png');
  snapshotPreview.src = lastSnapshotDataURL;
  snapshotModal.showModal();
}

function saveSnapshot() {
  const link = document.createElement('a');
  link.href = lastSnapshotDataURL;
  link.download = `jewelry-tryon-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function shareSnapshot() {
  if (navigator.share) {
    fetch(lastSnapshotDataURL)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], 'jewelry-tryon.png', { type: 'image/png' });
        navigator.share({
          title: 'Jewelry Try-On',
          text: 'Check out my look!',
          files: [file]
        });
      })
      .catch(console.error);
  } else {
    alert('Sharing not supported on this browser.');
  }
}

function closeSnapshotModal() {
  snapshotModal.close();
}

function toggleInfoModal() {
  if (infoModal.open) {
    infoModal.close();
  } else {
    infoModal.showModal();
  }
}