/*************************************************
 * 基本設定
 *************************************************/
let N = 6;
let STEP = 360 / N;

let outerIcons = ["🍎","🍌","🍇","🍊","🍓","🍍"];
let innerIcons = ["🐶","🐱","🐭","🐰","🐼","🐸"];

let currentAngle = 0;
let startOffset = 0;

/*************************************************
 * DOM取得
 *************************************************/
const svg = document.getElementById("wheel");

// SVGグループ生成
const outerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
outerGroup.id = "outer";

const innerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
innerGroup.id = "inner";

svg.appendChild(outerGroup);
svg.appendChild(innerGroup);

/*************************************************
 * 描画関数
 *************************************************/
function drawWheel() {
  outerGroup.innerHTML = "";
  innerGroup.innerHTML = "";

  // 外円
  outerGroup.appendChild(circle(160, "#fff3e0"));
  // 内円
  innerGroup.appendChild(circle(110, "#e3f2fd"));

  placeIcons(outerGroup, outerIcons, 140);
  placeIcons(innerGroup, innerIcons, 80);

  innerGroup.setAttribute("transform", `rotate(${currentAngle})`);
}

function circle(r, color) {
  const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  c.setAttribute("r", r);
  c.setAttribute("fill", color);
  c.setAttribute("stroke", "#333");
  c.setAttribute("stroke-width", "3");
  return c;
}

function placeIcons(group, icons, radius) {
  icons.forEach((icon, i) => {
    const angle = (360 / N) * i - 90;
    const rad = angle * Math.PI / 180;
    const x = radius * Math.cos(rad);
    const y = radius * Math.sin(rad);

    const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t.textContent = icon;
    t.setAttribute("x", x);
    t.setAttribute("y", y);
    t.setAttribute("font-size", "36");
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("dominant-baseline", "middle");
    group.appendChild(t);
  });
}

/*************************************************
 * タッチ・マウス操作（内円のみ）
 *************************************************/
let activePointerId = null;
let pointerStartX = 0;
let pointerStartY = 0;
let isDragging = false;

function getPointerAngle(e) {
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left - rect.width / 2;
  const y = e.clientY - rect.top - rect.height / 2;
  return Math.atan2(y, x) * 180 / Math.PI;
}

innerGroup.addEventListener("pointerdown", e => {
  if (activePointerId !== null || !e.isPrimary || e.button !== 0) return;
  e.preventDefault();
  activePointerId = e.pointerId;
  pointerStartX = e.clientX;
  pointerStartY = e.clientY;
  isDragging = false;
  startOffset = getPointerAngle(e) - currentAngle;
  innerGroup.setPointerCapture(e.pointerId);
  innerGroup.classList.add("dragging");
});

function updatePointerRotation(e) {
  if (Math.hypot(e.clientX - pointerStartX, e.clientY - pointerStartY) > 5) {
    isDragging = true;
  }
  if (isDragging) {
    currentAngle = getPointerAngle(e) - startOffset;
    innerGroup.setAttribute("transform", `rotate(${currentAngle})`);
  }
}

innerGroup.addEventListener("pointermove", e => {
  if (e.pointerId !== activePointerId) return;
  e.preventDefault();
  updatePointerRotation(e);
});

function finishRotation(e) {
  if (e.pointerId !== activePointerId) return;
  if (e.type === "pointerup") {
    updatePointerRotation(e);
    // マウスのクリックは1目盛り進める。ドラッグ後は追加で回さない。
    if (e.pointerType === "mouse" && !isDragging) currentAngle += STEP;
  }
  activePointerId = null;
  currentAngle = Math.round(currentAngle / STEP) * STEP;
  innerGroup.setAttribute("transform", `rotate(${currentAngle})`);
  innerGroup.classList.remove("dragging");
  if (innerGroup.hasPointerCapture(e.pointerId)) {
    innerGroup.releasePointerCapture(e.pointerId);
  }
}

innerGroup.addEventListener("pointerup", finishRotation);
innerGroup.addEventListener("pointercancel", finishRotation);
innerGroup.addEventListener("lostpointercapture", finishRotation);

/*************************************************
 * 管理画面（長押し3秒）
 *************************************************/
let pressTimer;

const adminButton = document.createElement("div");
adminButton.style.position = "fixed";
adminButton.style.right = "0";
adminButton.style.bottom = "0";
adminButton.style.width = "80px";
adminButton.style.height = "80px";
document.body.appendChild(adminButton);

const adminPanel = document.getElementById("adminPanel");
adminPanel.style.display = "none";
adminPanel.style.flexDirection = "column";
adminPanel.style.gap = "12px";
adminPanel.style.padding = "24px";
adminPanel.style.background = "#ffffffee";
adminPanel.style.position = "fixed";
adminPanel.style.inset = "0";

adminPanel.innerHTML = `
  <h3>設定</h3>

  <label>分割数
    <select id="division">
      <option>4</option>
      <option selected>6</option>
      <option>8</option>
    </select>
  </label>

  <label>外側
    <input id="outerInput" value="${outerIcons.join(",")}">
  </label>

  <label>内側
    <input id="innerInput" value="${innerIcons.join(",")}">
  </label>

  <button id="applyBtn">適用</button>
  <button id="closeBtn">×</button>
`;

let adminPointerId = null;

adminButton.addEventListener("pointerdown", e => {
  if (adminPointerId !== null || !e.isPrimary || e.button !== 0) return;
  e.preventDefault();
  adminPointerId = e.pointerId;
  adminButton.setPointerCapture(e.pointerId);
  pressTimer = setTimeout(() => {
    adminPanel.style.display = "flex";
  }, 3000);
});

function cancelAdminPress(e) {
  if (e.pointerId !== adminPointerId) return;
  clearTimeout(pressTimer);
  adminPointerId = null;
  if (adminButton.hasPointerCapture(e.pointerId)) {
    adminButton.releasePointerCapture(e.pointerId);
  }
}

adminButton.addEventListener("pointerup", cancelAdminPress);
adminButton.addEventListener("pointercancel", cancelAdminPress);
adminButton.addEventListener("lostpointercapture", cancelAdminPress);
adminButton.addEventListener("contextmenu", e => e.preventDefault());

document.getElementById("closeBtn").onclick = () => {
  adminPanel.style.display = "none";
};

document.getElementById("applyBtn").onclick = () => {
  const div = Number(document.getElementById("division").value);
  const o = document.getElementById("outerInput").value.split(",");
  const i = document.getElementById("innerInput").value.split(",");

  if (o.length !== div || i.length !== div) {
    alert("分割数とアイコン数を合わせてください");
    return;
  }

  N = div;
  STEP = 360 / N;
  outerIcons = o;
  innerIcons = i;
  currentAngle = 0;

  drawWheel();
  adminPanel.style.display = "none";
};

/*************************************************
 * 初期化
 *************************************************/
drawWheel();
