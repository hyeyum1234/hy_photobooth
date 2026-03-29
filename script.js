document.addEventListener("DOMContentLoaded", () => {
  // --- [설정 영역] ---
  const frameSources = ["frame1.png","frame2.png","frame3.png","frame4.png","frame5.png","frame6.png","frame7.png","frame8.png"];
  const stickerSources = ["sticker1.png","sticker2.png","sticker3.png","sticker4.png","sticker6.png","sticker7.png","sticker8.png","sticker9.png","sticker10.png","sticker11.png","sticker12.png","sticker13.png","sticker14.png","sticker15.png","sticker16.png","sticker17.png","sticker18.png","sticker19.png","sticker20.png","sticker21.png","sticker22.png"];
  const shutterSoundFile = "shutter.mp3";
  // ------------------

  // 모바일 감지
  const isMobile = () => window.matchMedia("(pointer: coarse)").matches;

  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;

  const canvas = document.getElementById("canvas");
  const resultCanvas = document.getElementById("resultCanvas");
  const ctx = resultCanvas.getContext("2d");

  const startBtn = document.getElementById("floatingStartBtn");
  const captureBtn = document.getElementById("floatingCaptureBtn");
  const flipBtn = document.getElementById("flipBtn");
  const saveBtn = document.getElementById("saveBtn");
  const undoBtn = document.getElementById("undoBtn");
  const clearPhotosBtn = document.getElementById("clearPhotosBtn");
  const resetAllBtn = document.getElementById("resetAllBtn");
  const cameraControls = document.getElementById("cameraControls");

  const PHOTO_W = 300;
  const PHOTO_H = 400;
  const TOTAL = 4;
  const GAP = 20;
  const SIDE = 30;
  const BOTTOM = 200;

  resultCanvas.width = PHOTO_W + SIDE * 2;
  resultCanvas.height = PHOTO_H * TOTAL + GAP * (TOTAL + 1) + BOTTOM;

  let photos = [];
  let photoImages = []; // ✅ 버그1 수정: 미리 로드된 Image 객체 보관
  let selectedFrame = null;
  let bgColor = "#ffffff";
  let count = 0;
  let countTimer = null;
  const availableStickers = [];
  let placedStickers = [[], [], [], []];
  let currentFacingMode = "user";
  let selectedStickerIndex = null;

  // 더블탭/더블클릭 감지용
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  let clickTimer = null;

  const shutterSound = new Audio(shutterSoundFile);
  shutterSound.load();

  const text1 = document.getElementById("text1");
  const text2 = document.getElementById("text2");
  const dateInput = document.getElementById("dateInput");

  const setTodayDate = () => {
    const today = new Date();
    dateInput.value = today.getFullYear() + "." + String(today.getMonth()+1).padStart(2,"0") + "." + String(today.getDate()).padStart(2,"0");
  };
  setTodayDate();

  // ✅ 버그3 수정: 폰트 미리 로드 후 시작
  async function loadFont() {
    try {
      await document.fonts.load("26px Gaegu");
      await document.fonts.load("bold 100px Gaegu");
      await document.fonts.load("20px Gaegu");
    } catch(e) {}
  }
  loadFont().then(() => redraw());

  async function startCamera(facingMode) {
    if (video.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } });
      video.srcObject = stream;
      currentFacingMode = facingMode;
      redraw();
    } catch (err) { alert("카메라를 시작할 수 없습니다."); }
  }

  flipBtn.onclick = () => {
    if (!video.srcObject) return;
    startCamera(currentFacingMode === "user" ? "environment" : "user");
  };

  // 프레임 로드
  frameSources.forEach(src => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const thumb = document.createElement("img");
      thumb.src = src;
      thumb.onclick = () => {
        selectedFrame = img;
        document.querySelectorAll(".frame-selection img").forEach(el => el.classList.remove("selected"));
        thumb.classList.add("selected");
        redraw();
      };
      document.getElementById("frameSelection").appendChild(thumb);
    };
  });

  // 스티커 로드
  stickerSources.forEach((src, index) => {
    if (!src) return;
    const img = new Image();
    img.src = src;
    img.onload = () => {
      availableStickers[index] = img;
      const thumb = document.createElement("img");
      thumb.src = src;
      thumb.className = "sticker-thumb";

      if (isMobile()) {
        thumb.addEventListener("click", () => {
          if (selectedStickerIndex === index) {
            selectedStickerIndex = null;
            thumb.classList.remove("sticker-selected");
          } else {
            selectedStickerIndex = index;
            document.querySelectorAll(".sticker-thumb").forEach(el => el.classList.remove("sticker-selected"));
            thumb.classList.add("sticker-selected");
          }
          updateStickerHint();
        });
      } else {
        thumb.draggable = true;
        thumb.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", index));
      }

      document.getElementById("stickerSelection").appendChild(thumb);
    };
  });

  function updateStickerHint() {
    let hint = document.getElementById("stickerHint");
    if (!hint) {
      hint = document.createElement("div");
      hint.id = "stickerHint";
      hint.style.cssText = "text-align:center;font-size:15px;color:#ff6b9d;margin:6px 0;font-family:Gaegu;";
      document.getElementById("stickerSelection").after(hint);
    }
    hint.textContent = selectedStickerIndex !== null
      ? "✅ 스티커 선택됨! 사진 위 원하는 위치를 탭하세요"
      : "";
  }

  // PC: 드래그앤드롭
  resultCanvas.addEventListener("dragover", (e) => e.preventDefault());
  resultCanvas.addEventListener("drop", (e) => {
    e.preventDefault();
    const stickerIdx = parseInt(e.dataTransfer.getData("text/plain"));
    const draggedSticker = availableStickers[stickerIdx];
    if (!draggedSticker) return;
    const { canvasX, canvasY } = getCanvasCoords(e.clientX, e.clientY);
    placeStickerAt(draggedSticker, canvasX, canvasY);
  });

  // ✅ 버그2 수정: PC 더블클릭 삭제 / 모바일 더블탭 삭제
  resultCanvas.addEventListener("click", (e) => {
    const { canvasX, canvasY } = getCanvasCoords(e.clientX, e.clientY);

    if (isMobile()) {
      const now = Date.now();
      const dx = canvasX - lastTapX;
      const dy = canvasY - lastTapY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isDoubleTap = (now - lastTapTime < 350) && dist < 30;

      if (isDoubleTap) {
        deleteStickerAt(canvasX, canvasY);
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;
      lastTapX = canvasX;
      lastTapY = canvasY;

      if (selectedStickerIndex !== null && availableStickers[selectedStickerIndex]) {
        placeStickerAt(availableStickers[selectedStickerIndex], canvasX, canvasY);
      }
    } else {
      // PC: 더블클릭 감지
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        deleteStickerAt(canvasX, canvasY);
      } else {
        clickTimer = setTimeout(() => {
          clickTimer = null;
        }, 300);
      }
    }
  });

  function getCanvasCoords(clientX, clientY) {
    const rect = resultCanvas.getBoundingClientRect();
    const scaleX = resultCanvas.width / rect.width;
    const scaleY = resultCanvas.height / rect.height;
    return {
      canvasX: (clientX - rect.left) * scaleX,
      canvasY: (clientY - rect.top) * scaleY,
    };
  }

  function placeStickerAt(sticker, canvasX, canvasY) {
    for (let i = 0; i < TOTAL; i++) {
      const slotX = SIDE;
      const slotY = GAP + i * (PHOTO_H + GAP);
      if (canvasX >= slotX && canvasX <= slotX + PHOTO_W && canvasY >= slotY && canvasY <= slotY + PHOTO_H) {
        const sW = 100;
        const sH = (sticker.height / sticker.width) * sW;
        placedStickers[i].push({ img: sticker, x: canvasX - slotX - sW / 2, y: canvasY - slotY - sH / 2, w: sW, h: sH });
        redraw();
        break;
      }
    }
  }

  function deleteStickerAt(canvasX, canvasY) {
    for (let i = 0; i < TOTAL; i++) {
      const slotX = SIDE;
      const slotY = GAP + i * (PHOTO_H + GAP);
      if (canvasX >= slotX && canvasX <= slotX + PHOTO_W && canvasY >= slotY && canvasY <= slotY + PHOTO_H) {
        const stickers = placedStickers[i];
        for (let j = stickers.length - 1; j >= 0; j--) {
          const s = stickers[j];
          if (canvasX >= slotX + s.x && canvasX <= slotX + s.x + s.w && canvasY >= slotY + s.y && canvasY <= slotY + s.y + s.h) {
            stickers.splice(j, 1);
            redraw();
            return;
          }
        }
      }
    }
  }

  startBtn.onclick = async () => {
    if (!selectedFrame) return alert("프레임을 먼저 선택해주세요!");
    await startCamera(currentFacingMode);
  };

  captureBtn.onclick = () => {
    if (photos.length >= TOTAL || count > 0) return;
    count = 3;
    redraw();
    countTimer = setInterval(() => {
      count--;
      if (count === 1) { shutterSound.currentTime = 0; shutterSound.play().catch(() => {}); }
      if (count <= 0) {
        clearInterval(countTimer);
        count = 0;
        canvas.width = PHOTO_W;
        canvas.height = PHOTO_H;
        canvas.getContext("2d").drawImage(video, 0, 0, PHOTO_W, PHOTO_H);

        // ✅ 버그1 수정: Image 객체로 미리 로드 후 저장 → 깜빡임 없음
        const dataURL = canvas.toDataURL();
        const img = new Image();
        img.onload = () => {
          photoImages.push(img);
          photos.push(dataURL);
          redraw();
        };
        img.src = dataURL;
      }
      redraw();
    }, 1000);
  };

  function redraw() {
    ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);

    for (let i = 0; i < TOTAL; i++) {
      const dx = SIDE;
      const dy = GAP + i * (PHOTO_H + GAP);

      if (photoImages[i]) {
        // ✅ 버그1 수정: 미리 로드된 Image 객체 사용
        ctx.drawImage(photoImages[i], dx, dy, PHOTO_W, PHOTO_H);
      } else if (i === photos.length && video.srcObject) {
        ctx.drawImage(video, dx, dy, PHOTO_W, PHOTO_H);
        if (count > 0) {
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.fillRect(dx, dy, PHOTO_W, PHOTO_H);
          ctx.fillStyle = "#fff";
          ctx.font = "bold 100px Gaegu, cursive";
          ctx.textAlign = "center";
          ctx.fillText(count, dx + PHOTO_W / 2, dy + PHOTO_H / 2 + 30);
        }
      } else {
        ctx.fillStyle = "#eee";
        ctx.fillRect(dx, dy, PHOTO_W, PHOTO_H);
      }

      placedStickers[i].forEach(s => ctx.drawImage(s.img, dx + s.x, dy + s.y, s.w, s.h));
    }

    if (selectedFrame) {
      ctx.drawImage(selectedFrame, (resultCanvas.width - selectedFrame.width) / 2, (resultCanvas.height - selectedFrame.height) / 2);
    }

    // ✅ 버그3 수정: cursive 폴백 추가
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.font = "26px Gaegu, cursive";
    ctx.fillText(text1.value, resultCanvas.width / 2, resultCanvas.height - 180);
    ctx.fillText(text2.value, resultCanvas.width / 2, resultCanvas.height - 145);
    ctx.font = "20px Gaegu, cursive";
    ctx.fillText(dateInput.value, resultCanvas.width / 2, resultCanvas.height - 110);

    updateButtons();
    if (video.srcObject && photos.length < TOTAL) requestAnimationFrame(redraw);
  }

  function updateButtons() {
    if (!video.srcObject) {
      startBtn.style.display = "block";
      startBtn.style.left = (SIDE + 20) + "px";
      startBtn.style.top = (GAP + PHOTO_H - 80) + "px";
      captureBtn.style.display = "none";
      cameraControls.style.display = "none";
    } else {
      startBtn.style.display = "none";
      captureBtn.style.display = (photos.length < TOTAL && count === 0) ? "block" : "none";
      captureBtn.style.left = (SIDE + PHOTO_W - 80) + "px";
      captureBtn.style.top = (GAP + photos.length * (PHOTO_H + GAP) + PHOTO_H - 80) + "px";
      cameraControls.style.display = "flex";
    }
  }

  saveBtn.onclick = () => {
    const link = document.createElement("a");
    link.download = "hyeyum_photo.png";
    link.href = resultCanvas.toDataURL();
    link.click();
  };

  undoBtn.onclick = () => {
    if (count > 0) {
      count = 0;
      if (countTimer) clearInterval(countTimer);
    } else if (photos.length > 0) {
      photos.pop();
      photoImages.pop(); // ✅ 버그1 수정: 같이 제거
    }
    redraw();
  };

  clearPhotosBtn.onclick = () => {
    if (confirm("찍은 사진들만 모두 지울까요? (스티커는 유지됩니다)")) {
      photos = [];
      photoImages = []; // ✅ 버그1 수정: 같이 초기화
      count = 0;
      if (countTimer) clearInterval(countTimer);
      redraw();
    }
  };

  resetAllBtn.onclick = () => {
    if (confirm("모든 설정(사진, 스티커, 프레임, 문구 등)을 초기화할까요?")) {
      photos = [];
      photoImages = []; // ✅ 버그1 수정: 같이 초기화
      placedStickers = [[], [], [], []];
      selectedFrame = null;
      bgColor = "#ffffff";
      text1.value = "";
      text2.value = "";
      setTodayDate();
      selectedStickerIndex = null;
      document.querySelectorAll(".sticker-thumb").forEach(el => el.classList.remove("sticker-selected"));
      document.querySelectorAll(".frame-selection img").forEach(el => el.classList.remove("selected"));
      document.querySelectorAll("#colorPicker button").forEach(b => b.classList.remove("selected"));
      count = 0;
      if (countTimer) clearInterval(countTimer);
      updateStickerHint();
      redraw();
    }
  };

  document.querySelectorAll("#colorPicker button").forEach(btn => {
    btn.onclick = () => {
      bgColor = btn.dataset.color;
      document.querySelectorAll("#colorPicker button").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      redraw();
    };
  });

  text1.addEventListener("input", redraw);
  text2.addEventListener("input", redraw);
  dateInput.addEventListener("input", redraw);
  redraw();
});
