const canvas = document.getElementById('colorWheel');
const ctx = canvas.getContext('2d');
const radius = canvas.width / 2;

// Store the base image for redrawing with the circle overlay
let baseImageData;

// Function to draw the color wheel
function drawColorWheel() {
    // Create image data for smooth rendering without artifacts
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    const edgeFeather = 1.5;
    
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            // Calculate distance and angle from center
            const dx = (x + 0.5) - radius;
            const dy = (y + 0.5) - radius;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx);
            
            // Only draw within the circle
            if (distance <= radius + edgeFeather) {
                const t = distance / radius; // 0 to 1
                const hue = ((angle * 180 / Math.PI) + 360) % 360;
                const saturation = t * 100;
                const lightness = 50; // Fixed at 50% (no white in middle)
                
                // Convert HSL to RGB
                const rgb = hslToRgb(hue, saturation, lightness);
                
                // Set pixel color
                const index = (y * canvas.width + x) * 4;
                data[index] = rgb.r;
                data[index + 1] = rgb.g;
                data[index + 2] = rgb.b;
                if (distance <= radius - edgeFeather) {
                    data[index + 3] = 255;
                } else {
                    const alpha = (radius + edgeFeather - distance) / (edgeFeather * 2);
                    data[index + 3] = Math.max(0, Math.min(255, Math.round(alpha * 255)));
                }
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Helper: HSL to RGB conversion
function hslToRgb(h, s, l) {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
        const k = (n + h / 30) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    const r = Math.round(255 * f(0));
    const g = Math.round(255 * f(8));
    const b = Math.round(255 * f(4));
    return {
        r: r,
        g: g,
        b: b,
        toArray: () => [r, g, b]
    };
}

drawColorWheel();

// Animation frame tracking
let animationFrameId = null;

// Start the main animation loop
function startAnimationLoop() {
    if (animationFrameId !== null) return; // Already running
    
    function tick() {
        animate();
        if (isDragging) {
            animationFrameId = requestAnimationFrame(tick);
        } else {
            animationFrameId = null;
        }
    }
    animationFrameId = requestAnimationFrame(tick);
}

// Elements to show colors
const selectedColorInput = document.getElementById('selectedColor');
const harmonyColorsContainer = document.getElementById('harmonyColors');
const selectedColorSwatch = document.getElementById('selectedColorSwatch');
const harmonyModeSelect = document.getElementById('harmonyMode');
const hueSlider = document.getElementById('hueSlider');
const saturationSlider = document.getElementById('saturationSlider');
const lightnessSlider = document.getElementById('lightnessSlider');
const hueValue = document.getElementById('hueValue');
const saturationValue = document.getElementById('saturationValue');
const lightnessValue = document.getElementById('lightnessValue');
const colorInput = selectedColorInput;

const imageUpload = document.getElementById('imageUpload');
const imageHue = document.getElementById('imageHue');
const imageHueValue = document.getElementById('imageHueValue');
const imageCanvas = document.getElementById('imageCanvas');
const imageCtx = imageCanvas.getContext('2d');
const imageDownload = document.getElementById('imageDownload');

// Default background before any selection
const initialBackgroundColor = '#f45f77';
document.body.style.backgroundColor = initialBackgroundColor;

// Current harmony mode
let harmonyMode = 'complementary';

// Store edited color values
let editedHue = 0;
let editedSaturation = 0;
let editedLightness = 50;
let isEditingColor = false;

// Variables for tracking drag state
let isDragging = false;
let mouseX = -1000;
let mouseY = -1000;
const circleRadius = 25; // Size of the white circle

// Variables for storing the last selected color position
let lastSelectedX = -1000;
let lastSelectedY = -1000;
let lastSelectedColor = '#ffffff';

let originalImageData = null;

// Helper: RGB → Hex
function rgbToHex(r, g, b) {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Helper: complementary color
function getComplementary(hex) {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    
    // Complementary hue is 180 degrees opposite
    const compH = (h + 180) % 360;
    
    // Convert back to RGB with same saturation and lightness
    const rgb = hslToRgb(compH, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// Helper: hex to RGB
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

// Helper: RGB to HSL
function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

// Helper: get harmony colors based on mode
function getHarmonyColors(hex) {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    
    const colors = [hex]; // Start with selected color
    
    switch(harmonyMode) {
        case 'monochromatic':
            // Same hue, different lightness
            colors.push(rgbToHex(...hslToRgb(h, s, Math.max(0, l - 20)).toArray()));
            colors.push(rgbToHex(...hslToRgb(h, s, Math.min(100, l + 20)).toArray()));
            break;
        case 'analogous':
            // Colors 30 degrees away
            colors.push(rgbToHex(...hslToRgb((h + 30) % 360, s, l).toArray()));
            colors.push(rgbToHex(...hslToRgb((h - 30 + 360) % 360, s, l).toArray()));
            break;
        case 'triadic':
            // Colors 120 degrees away
            colors.push(rgbToHex(...hslToRgb((h + 120) % 360, s, l).toArray()));
            colors.push(rgbToHex(...hslToRgb((h + 240) % 360, s, l).toArray()));
            break;
        case 'tetradic':
            // Colors 90 degrees away
            colors.push(rgbToHex(...hslToRgb((h + 90) % 360, s, l).toArray()));
            colors.push(rgbToHex(...hslToRgb((h + 180) % 360, s, l).toArray()));
            colors.push(rgbToHex(...hslToRgb((h + 270) % 360, s, l).toArray()));
            break;
        case 'complementary':
        default:
            // 180 degrees opposite
            colors.push(rgbToHex(...hslToRgb((h + 180) % 360, s, l).toArray()));
            break;
    }
    
    return colors;
}

// Helper: find position of color on wheel
function findColorPosition(hex) {
    const { r, g, b } = hexToRgb(hex);
    const { h, s, l } = rgbToHsl(r, g, b);
    
    // Position based on hue and saturation only (lightness is fixed at 50%)
    const distance = (s / 100) * radius;
    
    // Convert hue to angle in radians
    const angle = (h * Math.PI) / 180;
    
    // Calculate x, y position
    const x = radius + Math.cos(angle) * distance;
    const y = radius + Math.sin(angle) * distance;
    
    return { x, y };
}
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

    const { h, s, l } = rgbToHsl(pixel[0], pixel[1], pixel[2]);
    editedHue = Math.round(h);
    editedSaturation = Math.round(s);
    editedLightness = Math.round(l);
    hueSlider.value = editedHue;
    saturationSlider.value = editedSaturation;
    lightnessSlider.value = editedLightness;
    hueValue.textContent = editedHue + '°';
    saturationValue.textContent = editedSaturation + '%';
    lightnessValue.textContent = editedLightness + '%';
    lastDisplayedHue = editedHue;
    lastDisplayedSaturation = editedSaturation;

    selectedColorInput.value = hex;
    selectedColorSwatch.style.backgroundColor = hex;
    document.body.style.backgroundColor = hex;

    const compHex = getComplementary(hex);
    complementaryColorSpan.textContent = compHex;
    complementaryColorSwatch.style.backgroundColor = compHex;
});

// Helper: update complementary color display
function updateComplementaryDisplay(hexColor) {
    const compHex = getComplementary(hexColor);
    complementaryColorSpan.textContent = compHex;
    complementaryColorSwatch.style.backgroundColor = compHex;
}

// Helper: update harmony colors display
function updateHarmonyDisplay(hexColor) {
    const colors = getHarmonyColors(hexColor);
    harmonyColorsContainer.innerHTML = '';
    
    colors.forEach((color, index) => {
        const colorDiv = document.createElement('div');
        colorDiv.className = 'harmonyColor';
        
        const swatch = document.createElement('div');
        swatch.className = 'colorSwatch';
        swatch.style.backgroundColor = color;
        
        const text = document.createElement('span');
        text.textContent = color.toUpperCase();
        text.style.color = 'black';
        text.style.fontSize = '12px';
        
        colorDiv.appendChild(swatch);
        colorDiv.appendChild(text);
        harmonyColorsContainer.appendChild(colorDiv);
    });
}

let pendingHarmonyColor = null;
let harmonyRenderFramePending = false;

function scheduleHarmonyDisplay(hexColor) {
    pendingHarmonyColor = hexColor;
    if (harmonyRenderFramePending) {
        return;
    }

    harmonyRenderFramePending = true;
    requestAnimationFrame(() => {
        harmonyRenderFramePending = false;
        if (pendingHarmonyColor) {
            updateHarmonyDisplay(pendingHarmonyColor);
            pendingHarmonyColor = null;
        }
    });
}

// Handle harmony mode change
harmonyModeSelect.addEventListener('change', (e) => {
    harmonyMode = e.target.value;
    isDragging = false;
    // Show harmony for the edited color if currently editing, otherwise the wheel-picked color
    if (isEditingColor) {
        const editedColor = hslToRgb(editedHue, editedSaturation, editedLightness);
        const editedColorHex = rgbToHex(editedColor.r, editedColor.g, editedColor.b);
        updateHarmonyDisplay(editedColorHex);
        renderSelectionOnWheel(editedColorHex);
    } else {
        updateHarmonyDisplay(lastSelectedColor);
        renderSelectionOnWheel(lastSelectedColor);
    }
});

// Color editor sliders
hueSlider.addEventListener('input', (e) => {
    isDragging = false;
    editedHue = parseInt(e.target.value);
    hueValue.textContent = editedHue + '°';
    updateEditedColor();
});

saturationSlider.addEventListener('input', (e) => {
    isDragging = false;
    editedSaturation = parseInt(e.target.value);
    saturationValue.textContent = editedSaturation + '%';
    updateEditedColor();
});

lightnessSlider.addEventListener('input', (e) => {
    isDragging = false;
    editedLightness = parseInt(e.target.value);
    lightnessValue.textContent = editedLightness + '%';
    updateEditedColor();
});

// Store previous hue/saturation to detect when position changes
let lastDisplayedHue = editedHue;
let lastDisplayedSaturation = editedSaturation;

// Update the selected color based on editor sliders
function updateEditedColor() {
    isEditingColor = true;
    isDragging = false;
    const editedColor = hslToRgb(editedHue, editedSaturation, editedLightness);
    const editedColorHex = rgbToHex(editedColor.r, editedColor.g, editedColor.b);
    
    selectedColorInput.value = editedColorHex;
    selectedColorSwatch.style.backgroundColor = editedColorHex;
    document.body.style.backgroundColor = editedColorHex;
    
    // Check if position changed (hue or saturation changed)
    const positionChanged = lastDisplayedHue !== editedHue || lastDisplayedSaturation !== editedSaturation;
    
    if (positionChanged) {
        // Update circle position on wheel based on hue and saturation only
        const distance = (editedSaturation / 100) * radius;
        const angle = (editedHue * Math.PI) / 180;
        lastSelectedX = radius + Math.cos(angle) * distance;
        lastSelectedY = radius + Math.sin(angle) * distance;
        lastDisplayedHue = editedHue;
        lastDisplayedSaturation = editedSaturation;
    }
    
    lastSelectedColor = editedColorHex;
    renderSelectionOnWheel(editedColorHex);
    scheduleHarmonyDisplay(editedColorHex);
}

// Mouse down - start dragging
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    isEditingColor = false; // Reset so sliders update while dragging
    updateMousePosition(e);
    startAnimationLoop();
});

// Mouse move - update circle position
document.addEventListener('mousemove', (e) => {
    updateMousePosition(e);
    if (isDragging) {
        animate();
    }
});

// Mouse up - stop dragging
document.addEventListener('mouseup', () => {
    isDragging = false;
    // Only reset harmony colors if not editing with sliders
    if (!isEditingColor) {
        updateHarmonyDisplay(lastSelectedColor);
    }
    animate();
});

// Mouse leave - stop dragging if mouse leaves canvas
canvas.addEventListener('mouseleave', () => {
    isDragging = false;
    animate();
});

// Touch start - start dragging
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isDragging = true;
    isEditingColor = false; // Reset so sliders update while dragging
    updateTouchPosition(e);
    startAnimationLoop();
});

// Touch move - update circle position
document.addEventListener('touchmove', (e) => {
    if (isDragging) {
        e.preventDefault();
        updateTouchPosition(e);
        animate();
    }
});

// Touch end - stop dragging
document.addEventListener('touchend', () => {
    isDragging = false;
    // Only reset harmony colors if not editing with sliders
    if (!isEditingColor) {
        updateHarmonyDisplay(lastSelectedColor);
    }
    animate();
});

document.addEventListener('touchcancel', () => {
    isDragging = false;
    if (!isEditingColor) {
        updateHarmonyDisplay(lastSelectedColor);
    }
    animate();
});

function updateMousePosition(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
}

function updateTouchPosition(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (touch.clientX - rect.left) * scaleX;
    mouseY = (touch.clientY - rect.top) * scaleY;
}

// Helper: clamp position to wheel bounds
function getClampedPosition(x, y) {
    const dx = x - radius;
    const dy = y - radius;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    // Always clamp distance to radius, but keep the angle
    // Clamp slightly inward to avoid sampling black pixels at the very edge
    const maxDistance = Math.max(0, radius - 1);
    const clampedDistance = Math.min(distance, maxDistance);
    const clampedX = radius + Math.cos(angle) * clampedDistance;
    const clampedY = radius + Math.sin(angle) * clampedDistance;
    return { x: clampedX, y: clampedY };
}

function renderSelectionOnWheel(colorHex) {
    ctx.putImageData(baseImageData, 0, 0);

    if (lastSelectedX > -1000) {
        ctx.beginPath();
        ctx.arc(lastSelectedX, lastSelectedY, circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = colorHex;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();

        drawHarmonyCircles(colorHex);
    }
}

// Animation loop to draw the circle with color based on position
function animate() {
    if (isDragging && !isEditingColor) {
        // Restore the base color wheel
        ctx.putImageData(baseImageData, 0, 0);

        // Clamp circle position to wheel bounds
        const clampedPos = getClampedPosition(mouseX, mouseY);
        const displayX = clampedPos.x;
        const displayY = clampedPos.y;

        // Get the color at the clamped position
        const pixel = ctx.getImageData(displayX, displayY, 1, 1).data;
        const circleColor = rgbToHex(pixel[0], pixel[1], pixel[2]);

        // Update color displays live
        selectedColorInput.value = circleColor;
        selectedColorSwatch.style.backgroundColor = circleColor;
        document.body.style.backgroundColor = circleColor;

        // Update harmony colors live
        updateHarmonyDisplay(circleColor);

        // Store this as the last selected color
        lastSelectedColor = circleColor;
        lastSelectedX = displayX;
        lastSelectedY = displayY;

        // Update sliders to match picked color (only if not editing)
        if (!isEditingColor) {
            const { r, g, b } = hexToRgb(circleColor);
            const { h, s, l } = rgbToHsl(r, g, b);
            editedHue = Math.round(h);
            editedSaturation = Math.round(s);
            editedLightness = Math.round(l);
            hueSlider.value = editedHue;
            saturationSlider.value = editedSaturation;
            lightnessSlider.value = editedLightness;
            hueValue.textContent = editedHue + '°';
            saturationValue.textContent = editedSaturation + '%';
            lightnessValue.textContent = editedLightness + '%';
            lastDisplayedHue = editedHue;
            lastDisplayedSaturation = editedSaturation;
        }

        // Draw the circle with the color from that position
        ctx.beginPath();
        ctx.arc(displayX, displayY, circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = circleColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw harmony circles
        drawHarmonyCircles(circleColor);
    } else {
        // When not dragging, redraw with the last selected colors
        renderSelectionOnWheel(lastSelectedColor);
    }
}

// Function to draw the harmony color circles
function drawHarmonyCircles(hexColor) {
    const harmonyColors = getHarmonyColors(hexColor);
    
    // Calculate angle and distance from center for the selected color
    const dx = lastSelectedX - radius;
    const dy = lastSelectedY - radius;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Use exact slider values while editing to avoid tiny H/S drift from RGB/HEX rounding
    let h;
    let s;
    let l;
    if (isEditingColor) {
        h = editedHue;
        s = editedSaturation;
        l = editedLightness;
    } else {
        const rgb = hexToRgb(hexColor);
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        h = hsl.h;
        s = hsl.s;
        l = hsl.l;
    }
    
    // Adjust distance based on harmony mode
    // Use the same distance as the main circle so harmony circles reach the edge too
    const harmonyDistance = distance;
    
    switch(harmonyMode) {
        case 'monochromatic':
            // No harmony circles for monochromatic - only show the selected color
            break;
        case 'analogous':
            // 30 degrees on each side
            drawHarmonyCircleAt(
                hslToRgb((h + 30) % 360, s, l),
                angle + (30 * Math.PI / 180),
                harmonyDistance
            );
            drawHarmonyCircleAt(
                hslToRgb((h - 30 + 360) % 360, s, l),
                angle - (30 * Math.PI / 180),
                harmonyDistance
            );
            break;
        case 'triadic':
            // 120 degrees away
            drawHarmonyCircleAt(
                hslToRgb((h + 120) % 360, s, l),
                angle + (120 * Math.PI / 180),
                harmonyDistance
            );
            drawHarmonyCircleAt(
                hslToRgb((h + 240) % 360, s, l),
                angle + (240 * Math.PI / 180),
                harmonyDistance
            );
            break;
        case 'tetradic':
            // 90, 180, 270 degrees away
            drawHarmonyCircleAt(
                hslToRgb((h + 90) % 360, s, l),
                angle + (90 * Math.PI / 180),
                harmonyDistance
            );
            drawHarmonyCircleAt(
                hslToRgb((h + 180) % 360, s, l),
                angle + Math.PI,
                harmonyDistance
            );
            drawHarmonyCircleAt(
                hslToRgb((h + 270) % 360, s, l),
                angle + (270 * Math.PI / 180),
                harmonyDistance
            );
            break;
        case 'complementary':
        default:
            // 180 degrees opposite
            drawHarmonyCircleAt(
                hslToRgb((h + 180) % 360, s, l),
                angle + Math.PI,
                harmonyDistance
            );
            break;
    }
}

// Helper: draw a single harmony circle
function drawHarmonyCircleAt(rgbColor, harmonyAngle, distance) {
    const harmonyX = radius + Math.cos(harmonyAngle) * distance;
    const harmonyY = radius + Math.sin(harmonyAngle) * distance;
    const harmonyHex = rgbToHex(rgbColor.r, rgbColor.g, rgbColor.b);
    
    ctx.beginPath();
    ctx.arc(harmonyX, harmonyY, 15, 0, Math.PI * 2);
    ctx.fillStyle = harmonyHex;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// Handle custom color input
colorInput.addEventListener('input', (e) => {
    const customColor = e.target.value;
    
    // Validate hex color
    if (!/^#[0-9A-F]{6}$/i.test(customColor)) {
        return;
    }
    
    const pos = findColorPosition(customColor);
    
    lastSelectedColor = customColor;
    lastSelectedX = pos.x;
    lastSelectedY = pos.y;
    isDragging = false;
    isEditingColor = false;
    
    // Update displays
    selectedColorInput.value = customColor;
    selectedColorSwatch.style.backgroundColor = customColor;
    document.body.style.backgroundColor = customColor;
    
    // Update sliders
    const { r, g, b } = hexToRgb(customColor);
    const { h, s, l } = rgbToHsl(r, g, b);
    editedHue = Math.round(h);
    editedSaturation = Math.round(s);
    editedLightness = Math.round(l);
    hueSlider.value = editedHue;
    saturationSlider.value = editedSaturation;
    lightnessSlider.value = editedLightness;
    hueValue.textContent = editedHue + '°';
    saturationValue.textContent = editedSaturation + '%';
    lightnessValue.textContent = editedLightness + '%';
    lastDisplayedHue = editedHue;
    lastDisplayedSaturation = editedSaturation;
    
    // Update harmony colors display
    updateHarmonyDisplay(customColor);
    
    animate();
});

function loadImageToCanvas(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const maxWidth = 600;
            const maxHeight = 420;
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
            const width = Math.round(img.width * scale);
            const height = Math.round(img.height * scale);

            imageCanvas.width = width;
            imageCanvas.height = height;
            imageCtx.clearRect(0, 0, width, height);
            imageCtx.drawImage(img, 0, 0, width, height);
            originalImageData = imageCtx.getImageData(0, 0, width, height);

            imageHue.value = 0;
            imageHueValue.textContent = '0°';
            imageDownload.disabled = false;
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function downloadEditedImage() {
    if (!originalImageData || imageCanvas.width === 0 || imageCanvas.height === 0) {
        return;
    }

    const link = document.createElement('a');
    link.href = imageCanvas.toDataURL('image/png');
    link.download = 'hue-edited-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function applyHueShiftToImage(degrees) {
    if (!originalImageData) return;

    const width = originalImageData.width;
    const height = originalImageData.height;
    const src = originalImageData.data;
    const output = imageCtx.createImageData(width, height);
    const dst = output.data;

    for (let i = 0; i < src.length; i += 4) {
        const alpha = src[i + 3];
        if (alpha === 0) {
            dst[i] = 0;
            dst[i + 1] = 0;
            dst[i + 2] = 0;
            dst[i + 3] = 0;
            continue;
        }

        const { h, s, l } = rgbToHsl(src[i], src[i + 1], src[i + 2]);
        const newHue = (h + degrees + 360) % 360;
        const rgb = hslToRgb(newHue, s, l);

        dst[i] = rgb.r;
        dst[i + 1] = rgb.g;
        dst[i + 2] = rgb.b;
        dst[i + 3] = alpha;
    }

    imageCtx.putImageData(output, 0, 0);
}

imageUpload.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    loadImageToCanvas(file);
});

imageHue.addEventListener('input', (e) => {
    const degrees = parseInt(e.target.value);
    imageHueValue.textContent = degrees + '°';
    applyHueShiftToImage(degrees);
});

imageDownload.addEventListener('click', () => {
    downloadEditedImage();
});