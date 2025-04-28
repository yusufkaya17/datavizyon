// --- GLOBAL DEĞİŞKENLER VE DOM ELEMENTLERİ ---
const canvas = document.getElementById('drawingCanvas');
// ---- KONTROL KODU ----
if (canvas) {
    console.log(">>> Canvas elementi bulundu!");
} else {
    console.error("!!!!!! HATA: HTML içinde 'drawingCanvas' ID'li element BULUNAMADI !!!!!!");
}
// ---- KONTROL KODU BİTTİ ----
const ctx = canvas.getContext('2d');
const predictButton = document.getElementById('predictButton');
const clearButton = document.getElementById('clearButton');
const predictionArea = document.getElementById('predictionArea');
const normalizedImageContainer = document.getElementById('normalizedImageContainer');
const normalizedImage = document.getElementById('normalizedImage');

// Network Animasyon Elementleri
const inputLayer = document.querySelector('.input-layer');
const hiddenLayer1 = document.querySelector('.hidden-layer-1');
const hiddenLayer2 = document.querySelector('.hidden-layer-2');
const outputLayer = document.querySelector('.output-layer');
const svg = document.getElementById('connections');
const networkContainer = document.querySelector('.network-container');

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Network Animasyon Verileri
const config = { inputNodes: 5, hiddenNodes1: 7, hiddenNodes2: 6, outputNodes: 10 };
let allNodes = { input: [], hidden1: [], hidden2: [], output: [] };
let allLines = [];
let animationTimeoutIds = [];

function initializeCanvas() {
    // Canvas ayarları
    ctx.strokeStyle = '#000000'; // <<<--- SİYAH Çizgi Rengi
    ctx.lineWidth = 18;         // <<<--- Kalınlığı istersen ayarla (18 veya 20 iyi olabilir)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    clearCanvas(); // Başlangıçta temizle

    // Mavi dikdörtgen test kodunu kaldırdığından emin ol
}
function clearCanvas() {
    ctx.fillStyle = '#FFFFFF'; // <<<--- BEYAZ Arka Plan Rengi
    ctx.fillRect(0, 0, canvas.width, canvas.height); // Arka planı boya
    predictionArea.innerText = 'Çizim Yapın veya Tahmin Edin';
    normalizedImage.style.display = 'none';
    normalizedImage.src = '';
    if (typeof clearHighlights === 'function') {
        clearHighlights();
    }
    console.log("Canvas temizlendi (Beyaz Arka Plan).");
}
function draw(e) {
    // console.log("--- draw çağrıldı (isDrawing:", isDrawing, ")"); // Bunu istersen kapatabilirsin
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect(); // Canvas'ın pozisyonunu al
    const currentX = e.offsetX !== undefined ? e.offsetX : e.touches[0].clientX - rect.left; // offsetX varsa kullan, yoksa hesapla
    const currentY = e.offsetY !== undefined ? e.offsetY : e.touches[0].clientY - rect.top; // offsetY varsa kullan, yoksa hesapla

    // ---- KOORDİNAT LOG ----
    console.log(`Koordinatlar: last=(${lastX.toFixed(1)}, ${lastY.toFixed(1)}) current=(${currentX.toFixed(1)}, ${currentY.toFixed(1)})`);
    // ---- LOG BİTTİ ----

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
    ctx.stroke();
// ---- TEST ÇİZİMİ ----
    ctx.fillStyle = 'red'; // Geçici olarak kırmızı yap
    ctx.fillRect(currentX - 2, currentY - 2, 4, 4); // Her çizim noktasında küçük kırmızı kare çiz
// ---- TEST BİTTİ ----
    [lastX, lastY] = [currentX, currentY]; // Güncel pozisyonu kaydet
}

function startDrawing(e) {
    // console.log(">>> startDrawing tetiklendi!"); // Bunu istersen kapatabilirsin
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    [lastX, lastY] = [e.offsetX !== undefined ? e.offsetX : e.touches[0].clientX - rect.left,
                      e.offsetY !== undefined ? e.offsetY : e.touches[0].clientY - rect.top];
    // ---- BAŞLANGIÇ KOORDİNAT LOG ----
     console.log(`Başlangıç: (${lastX.toFixed(1)}, ${lastY.toFixed(1)})`);
    // ---- LOG BİTTİ ----
}

function stopDrawing() {
    if (isDrawing) {
       isDrawing = false;
       ctx.beginPath(); // Yolu sıfırla
    }
}

// --- PYTHON İLE İLETİŞİM ---
async function requestPrediction() {
    if (isDrawing) return; // Çizim bitmeden tahmin etme

    // Canvas boş mu kontrolü (basitçe beyaz piksel sayısına bakılabilir)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const isCanvasBlank = !imageData.data.some(channel => channel !== 255); // Tüm pikseller beyazsa boştur

    if (isCanvasBlank) {
        predictionArea.innerText = 'Lütfen önce bir rakam çizin!';
        return;
    }


    const imageDataURL = canvas.toDataURL('image/png'); // PNG olarak al
    predictionArea.innerText = 'Tahmin ediliyor...';
    predictButton.disabled = true; // Butonları kilitle
    clearButton.disabled = true;
    normalizedImage.style.display = 'none';
    normalizedImage.src = '';
    clearHighlights(); // Önceki animasyonu temizle

    console.log("JS: Python 'predict_digit' fonksiyonu çağrılıyor...");
    try {
        // Python'daki 'predict_digit' fonksiyonunu çağır ve sonucu bekle
        let result = await eel.predict_digit(imageDataURL)(); // () unutma!

        console.log("JS: Python'dan sonuç alındı:", result);

        if (result && result.error) {
            predictionArea.innerText = `Hata: ${result.error}`;
            console.error("Python Hatası:", result.error);
        } else if (result) {
            predictionArea.innerText = `Tahmin: ${result.prediction} (%${result.confidence.toFixed(1)})`;

            // Normalize edilmiş resmi göster
            if (result.normalized_image) {
                normalizedImage.src = result.normalized_image;
                normalizedImage.style.display = 'block';
            }

            // --- Neural Network Animasyonunu Tetikle ---
            if (typeof generatePathsToOutput === 'function') {
                 randomizeNodeValues(); // Node değerlerini rastgele yap (görsel çeşitlilik)
                 generatePathsToOutput(result.prediction); // Tahmine göre animasyon
            } else {
                 console.error("Animasyon fonksiyonu (generatePathsToOutput) bulunamadı!");
            }
            // --- ---

        } else {
            predictionArea.innerText = 'Python\'dan beklenmedik bir sonuç alındı.';
            console.error("Geçersiz sonuç:", result);
        }
    } catch (error) {
        console.error("JS Hatası (Python ile iletişim):", error);
        predictionArea.innerText = 'Python ile iletişim kurulamadı!';
    } finally {
        predictButton.disabled = false; // Butonları aç
        clearButton.disabled = false;
    }
}


// --- NETWORK ANİMASYON FONKSİYONLARI (Önceki koddan alındı) ---

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createNode(layerType, index) {
    const node = document.createElement('div');
    node.classList.add('node');
    let nodeId = `${layerType.charAt(0)}${index}`; // i0, h1_0, h2_0, o0 gibi ID'ler
    let nodeValue = 0;

    // ID ve başlangıç değerlerini ayarla
     switch (layerType) {
        case 'input':   nodeValue = getRandomInt(1, 99); break;
        case 'hidden1': nodeId = `h1_${index}`; nodeValue = getRandomInt(1, 99); break;
        case 'hidden2': nodeId = `h2_${index}`; nodeValue = getRandomInt(1, 99); break;
        case 'output':  node.classList.add('output'); node.textContent = index; break; // Çıkışta sadece index göster
    }
    node.dataset.layer = layerType;
    node.dataset.id = nodeId;

    // Değerleri ata (çıkış hariç)
    if (layerType !== 'output') {
        node.dataset.value = nodeValue;
        node.textContent = nodeValue;
    } else {
         node.dataset.value = 0; // Çıkışın kendi değeri yok
    }
    return node;
}

function randomizeNodeValues() {
    ['input', 'hidden1', 'hidden2'].forEach(layerKey => {
        allNodes[layerKey].forEach(node => {
            const newValue = getRandomInt(1, 99);
            node.dataset.value = newValue;
            node.textContent = newValue;
        });
    });
    console.log("Animasyon için node değerleri yenilendi.");
}

function initializeNetwork() {
    // Mevcut node'ları temizle (etiketleri koru)
    inputLayer.querySelectorAll('.node').forEach(n => n.remove());
    hiddenLayer1.querySelectorAll('.node').forEach(n => n.remove());
    hiddenLayer2.querySelectorAll('.node').forEach(n => n.remove());
    outputLayer.querySelectorAll('.node').forEach(n => n.remove());
    svg.innerHTML = ''; // Bağlantıları temizle
    allNodes = { input: [], hidden1: [], hidden2: [], output: [] };
    allLines = [];
    clearAnimationTimeouts();

    // Düğümleri Oluştur ve Ekle
    for (let i = 0; i < config.inputNodes; i++) { const node = createNode('input', i); inputLayer.appendChild(node); allNodes.input.push(node); }
    for (let i = 0; i < config.hiddenNodes1; i++) { const node = createNode('hidden1', i); hiddenLayer1.appendChild(node); allNodes.hidden1.push(node); }
    for (let i = 0; i < config.hiddenNodes2; i++) { const node = createNode('hidden2', i); hiddenLayer2.appendChild(node); allNodes.hidden2.push(node); }
    for (let i = 0; i < config.outputNodes; i++) { const node = createNode('output', i); outputLayer.appendChild(node); allNodes.output.push(node); }
    console.log("Network yapısı oluşturuldu.");
}

function getNodeCenter(nodeElement) {
    const containerRect = networkContainer.getBoundingClientRect();
    if (!nodeElement || !nodeElement.offsetParent) return { x: 0, y: 0 }; // Düğüm yoksa
    const nodeRect = nodeElement.getBoundingClientRect();
    // SVG'nin container'a göre göreceli koordinatları
    const x = nodeRect.left + nodeRect.width / 2 - containerRect.left;
    const y = nodeRect.top + nodeRect.height / 2 - containerRect.top;
    return { x, y };
}

function drawConnections() {
    svg.innerHTML = ''; // Öncekileri temizle
    allLines = [];

    const drawLayerConnections = (fromLayerNodes, toLayerNodes) => {
        fromLayerNodes.forEach(fromNode => {
            const start = getNodeCenter(fromNode);
            toLayerNodes.forEach(toNode => {
                const end = getNodeCenter(toNode);
                if ((start.x === 0 && start.y === 0) || (end.x === 0 && end.y === 0)) return; // Geçersizse çizme

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', start.x); line.setAttribute('y1', start.y);
                line.setAttribute('x2', end.x); line.setAttribute('y2', end.y);
                line.dataset.from = fromNode.dataset.id;
                line.dataset.to = toNode.dataset.id;
                svg.appendChild(line);
                allLines.push(line);
            });
        });
    };

    // DOM güncellendikten sonra çizim yap
    requestAnimationFrame(() => {
        drawLayerConnections(allNodes.input, allNodes.hidden1);
        drawLayerConnections(allNodes.hidden1, allNodes.hidden2);
        drawLayerConnections(allNodes.hidden2, allNodes.output);
        console.log(`Toplam ${allLines.length} bağlantı çizildi.`);
    });
}

function clearAnimationTimeouts() {
    animationTimeoutIds.forEach(clearTimeout);
    animationTimeoutIds = [];
}

function clearHighlights() {
    clearAnimationTimeouts();
    document.querySelectorAll('.node.highlight').forEach(node => node.classList.remove('highlight'));
    document.querySelectorAll('line.animated-highlight, line.highlight').forEach(line => {
        line.classList.remove('animated-highlight', 'highlight');
        line.style.strokeDasharray = '';
        line.style.strokeDashoffset = '';
    });
}

function animateLine(lineElement, delay) {
    if (!lineElement) return;
    const length = lineElement.getTotalLength ? lineElement.getTotalLength() : 0; // SVG line uzunluğu

    if (!length || isNaN(length) || length < 1) { // Çok kısa veya geçersizse statik vurgula
        const staticHighlightTimeoutId = setTimeout(() => lineElement?.classList.add('highlight'), delay);
        animationTimeoutIds.push(staticHighlightTimeoutId);
        return;
    }

    lineElement.style.strokeDasharray = length;
    lineElement.style.strokeDashoffset = length;

    const timeoutId = setTimeout(() => {
        lineElement.classList.add('animated-highlight');
        const animationDuration = 500; // CSS ile aynı olmalı
        // Animasyon bitince statik vurguya geç
        const staticHighlightTimeoutId = setTimeout(() => {
            if (lineElement.classList.contains('animated-highlight')) { // Hâlâ varsa temizle
                lineElement.classList.remove('animated-highlight');
                lineElement.style.strokeDasharray = '';
                lineElement.style.strokeDashoffset = '';
                lineElement.classList.add('highlight'); // Statik vurguyu ekle
            }
        }, animationDuration);
        animationTimeoutIds.push(staticHighlightTimeoutId);
    }, delay);
    animationTimeoutIds.push(timeoutId);
}

function selectNodeBasedOnValue(availableNodes, excludeIds = new Set(), topN = 3) {
    const candidates = availableNodes.filter(node => !excludeIds.has(node.dataset.id));
    if (candidates.length === 0) {
        // Eğer dışlama sonrası aday kalmazsa, dışlanmamış ilk düğümü veya herhangi birini al
         const fallback = availableNodes.find(node => !excludeIds.has(node.dataset.id)) || availableNodes[0];
        console.warn("Hariç tutma sonrası aday kalmadı, fallback kullanılıyor:", fallback?.dataset?.id);
        return fallback || null;
    }

    candidates.sort((a, b) => parseInt(b.dataset.value) - parseInt(a.dataset.value)); // Değere göre sırala
    const numTopChoices = Math.min(candidates.length, topN);
    const topChoices = candidates.slice(0, numTopChoices);

    if (topChoices.length === 0) return candidates[0]; // Hata durumu, ilkini al

    return topChoices[getRandomInt(0, topChoices.length - 1)]; // En iyi N arasından rastgele seç
}

function generatePathsToOutput(targetOutputIndex) {
    clearHighlights(); // Önceki vurguları temizle

    const targetOutputNode = allNodes.output[targetOutputIndex];
    if (!targetOutputNode) {
         console.error(`Animasyon için hedef çıktı düğümü bulunamadı: index ${targetOutputIndex}`);
         return;
    }

    const numPaths = getRandomInt(3, 4); // Oluşturulacak yol sayısı
    const usedInputNodeIds = new Set();
    const usedHidden1NodeIds = new Set();
    const usedHidden2NodeIds = new Set();

    console.log(`Animasyon: Hedef ${targetOutputIndex} için ${numPaths} yol oluşturuluyor...`);
    let pathDelayOffset = 0; // Yollar arası gecikme

    for (let i = 0; i < numPaths; i++) {
        // 1. Rastgele ve değere göre node seçimi (mümkünse farklı)
        const selectedInputNode = selectNodeBasedOnValue(allNodes.input, usedInputNodeIds, 3);
        if (!selectedInputNode) continue; // Uygun node yoksa atla
        usedInputNodeIds.add(selectedInputNode.dataset.id);

        const selectedHidden1Node = selectNodeBasedOnValue(allNodes.hidden1, usedHidden1NodeIds, 3);
        if (!selectedHidden1Node) continue;
        usedHidden1NodeIds.add(selectedHidden1Node.dataset.id);

        const selectedHidden2Node = selectNodeBasedOnValue(allNodes.hidden2, usedHidden2NodeIds, 3);
        if (!selectedHidden2Node) continue;
        usedHidden2NodeIds.add(selectedHidden2Node.dataset.id);

        // 2. İlgili bağlantı çizgilerini bul
        const line1 = allLines.find(l => l.dataset.from === selectedInputNode.dataset.id && l.dataset.to === selectedHidden1Node.dataset.id);
        const line2 = allLines.find(l => l.dataset.from === selectedHidden1Node.dataset.id && l.dataset.to === selectedHidden2Node.dataset.id);
        const line3 = allLines.find(l => l.dataset.from === selectedHidden2Node.dataset.id && l.dataset.to === targetOutputNode.dataset.id);

        if (!line1 || !line2 || !line3) {
            console.warn(`Yol ${i+1} için çizgiler bulunamadı, animasyon atlandı.`);
            continue;
        }

        // 3. Animasyonları zamanla
        const segmentDelay = 500; // Her adımın süresi
        const nodeHighlightDelay = 50; // Node vurgulama gecikmesi

        // Girdi -> H1
        const inputTimeoutId = setTimeout(() => selectedInputNode.classList.add('highlight'), pathDelayOffset + nodeHighlightDelay);
        animationTimeoutIds.push(inputTimeoutId);
        animateLine(line1, pathDelayOffset + nodeHighlightDelay);

        // H1 -> H2
        const h1TimeoutId = setTimeout(() => selectedHidden1Node.classList.add('highlight'), pathDelayOffset + segmentDelay + nodeHighlightDelay);
        animationTimeoutIds.push(h1TimeoutId);
        animateLine(line2, pathDelayOffset + segmentDelay + nodeHighlightDelay);

        // H2 -> Çıkış
        const h2TimeoutId = setTimeout(() => selectedHidden2Node.classList.add('highlight'), pathDelayOffset + segmentDelay * 2 + nodeHighlightDelay);
        animationTimeoutIds.push(h2TimeoutId);
        animateLine(line3, pathDelayOffset + segmentDelay * 2 + nodeHighlightDelay);

        // Çıkış Node'u (en son)
        const outputTimeoutId = setTimeout(() => targetOutputNode.classList.add('highlight'), pathDelayOffset + segmentDelay * 3 + nodeHighlightDelay);
        animationTimeoutIds.push(outputTimeoutId);

        pathDelayOffset += 200; // Sonraki yol biraz daha geç başlasın
    }
    console.log("Animasyon zamanlamaları ayarlandı.");
}


// --- OLAY DİNLEYİCİLERİ VE BAŞLANGIÇ ---

// Canvas Olayları
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

// Buton Olayları
clearButton.addEventListener('click', clearCanvas);
predictButton.addEventListener('click', requestPrediction);

// Sayfa Yüklendiğinde Çalışacaklar
window.addEventListener('load', () => {
    console.log("Sayfa yüklendi.");
    initializeCanvas();     // Canvas'ı hazırla
    initializeNetwork();    // Network yapısını oluştur
    setTimeout(drawConnections, 150); // Bağlantıları çiz (DOM hazır olunca)

    // Pencere yeniden boyutlandırıldığında bağlantıları güncelle
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        clearHighlights(); // Vurguları temizle
        resizeTimer = setTimeout(() => {
            requestAnimationFrame(drawConnections); // Bağlantıları yeniden çiz/pozisyonla
            console.log("Pencere boyutu değişti, bağlantılar güncellendi.");
        }, 250);
    });
});

console.log("script.js yüklendi ve çalışmaya hazır.");