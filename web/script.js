// --- GLOBAL DEĞİŞKENLER VE DOM ELEMENTLERİ ---
const canvas = document.getElementById('drawingCanvas');
// ---- KONTROL KODU ----
if (!canvas) {
    console.error("!!!!!! HATA: HTML içinde 'drawingCanvas' ID'li element BULUNAMADI !!!!!!");
    // Hata durumunda script'in devam etmesini engellemek iyi olabilir
    throw new Error("Canvas elementi bulunamadı!");
} else {
     console.log(">>> Canvas elementi bulundu!");
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
// Not: Bu config değerleri görselleştirmedeki düğüm sayısını belirler,
// gerçek model yapısıyla aynı olmak zorunda değildir.
const config = { inputNodes: 10, hiddenNodes1: 8, hiddenNodes2: 8, outputNodes: 10 }; // Örnek değerler
let allNodes = { input: [], hidden1: [], hidden2: [], output: [] };
let allLines = [];
let animationTimeoutIds = [];

// --- CANVAS FONKSİYONLARI ---
function initializeCanvas() {
    ctx.strokeStyle = '#000000'; // Siyah Çizgi
    ctx.lineWidth = 18;         // Kalınlık
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    clearCanvas(); // Başlangıçta temizle
    console.log("Canvas başlatıldı.");
}

function clearCanvas() {
    ctx.fillStyle = '#FFFFFF'; // Beyaz Arka Plan
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    predictionArea.innerText = 'Çizim Yapın veya Tahmin Edin';
    // Normalize edilmiş resmi gizle ve içeriğini temizle
    normalizedImage.style.display = 'none';
    normalizedImage.src = '';
    normalizedImage.classList.remove('visible'); // Animasyon sınıfını kaldır
    normalizedImageContainer?.classList.remove('updated'); // Vurgu sınıfını kaldır

    // Animasyon varsa temizle
    if (typeof clearHighlights === 'function') {
        clearHighlights();
    }
    // Gizli katman düğümlerinin değerlerini sıfırla (görsel olarak)
    if (allNodes && allNodes.hidden1 && allNodes.hidden2) {
        [...allNodes.hidden1, ...allNodes.hidden2].forEach(node => {
            node.textContent = "0.00";
            node.dataset.value = "0"; // Değeri de sıfırla
        });
    }
    console.log("Canvas temizlendi.");
}

function draw(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    // Dokunmatik veya fare olayları için koordinatları al
    const currentX = e.touches ? e.touches[0].clientX - rect.left : e.offsetX;
    const currentY = e.touches ? e.touches[0].clientY - rect.top : e.offsetY;

    // Çizim
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke(); // Ana çizgiyi çiz

    // Pozisyonu güncelle
    [lastX, lastY] = [currentX, currentY];
}

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    // Başlangıç pozisyonunu al
    [lastX, lastY] = [e.touches ? e.touches[0].clientX - rect.left : e.offsetX,
                      e.touches ? e.touches[0].clientY - rect.top : e.offsetY];

    // Tek tıklama/dokunma için küçük bir nokta çiz (opsiyonel)
    ctx.beginPath();
    ctx.arc(lastX, lastY, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000000'; // Nokta rengi
    ctx.fill();
    ctx.beginPath(); // Yeni çizgi için yolu başlat
    ctx.moveTo(lastX, lastY); // Çizginin başlangıcını ayarla
}

function stopDrawing() {
    if (isDrawing) {
       isDrawing = false;
       ctx.beginPath(); // Mevcut çizim yolunu bitir
    }
}

// --- PYTHON İLE İLETİŞİM ---
async function requestPrediction() {
    if (isDrawing) return;

    // Canvas boş mu kontrolü
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // Alfa kanalını da kontrol et (bazı tarayıcılar için)
    const isCanvasBlank = !imageData.data.some((channel, i) => (i % 4 === 3 ? channel > 0 : channel !== 255));

    if (isCanvasBlank) {
        predictionArea.innerText = 'Lütfen önce bir rakam çizin!';
        return;
    }

    const imageDataURL = canvas.toDataURL('image/png');
    predictionArea.innerText = 'Tahmin ediliyor...';
    predictButton.disabled = true;
    clearButton.disabled = true;
    normalizedImage.style.display = 'none'; // Önce gizle
    normalizedImage.src = '';
    normalizedImage.classList.remove('visible');
    normalizedImageContainer?.classList.remove('updated');
    clearHighlights();

    console.log("JS: Python 'predict_digit' fonksiyonu çağrılıyor...");
    try {
        let result = await eel.predict_digit(imageDataURL)();

        console.log("JS: Python'dan sonuç alındı:", result);

        if (result && result.error) {
            predictionArea.innerText = `Hata: ${result.error}`;
            console.error("Python Hatası:", result.error);
        } else if (result && result.prediction !== undefined) { // Sonucun geçerli olup olmadığını kontrol et
            predictionArea.innerText = `Tahmin: ${result.prediction} (%${result.confidence.toFixed(1)})`;

            // Normalize edilmiş resmi göster (HTML/CSS büyütülmüş haliyle)
            if (result.normalized_image) {
                normalizedImage.src = result.normalized_image;
                normalizedImage.style.display = 'block'; // Görünür yap
                // Fade-in animasyonu için sınıf ekle (CSS'de tanımlı olmalı)
                setTimeout(() => normalizedImage.classList.add('visible'), 10); // Küçük gecikme
                // Konteyner vurgu animasyonu (CSS'de tanımlı olmalı)
                normalizedImageContainer?.classList.add('updated');
                setTimeout(() => normalizedImageContainer?.classList.remove('updated'), 600);
            }

            // --- Network Animasyonunu Tetikle ---
            if (typeof generatePathsToOutput === 'function') {
                 randomizeHiddenNodeValues(); // SADECE Gizli katman değerlerini ondalıklı rastgele yap
                 generatePathsToOutput(result.prediction); // Tahmine göre animasyon
            } else {
                 console.error("Animasyon fonksiyonu (generatePathsToOutput) bulunamadı!");
            }

        } else {
            predictionArea.innerText = 'Python\'dan geçersiz sonuç alındı.';
            console.error("Geçersiz sonuç:", result);
        }
    } catch (error) {
        console.error("JS Hatası (Python ile iletişim):", error);
        predictionArea.innerText = 'Sunucu ile iletişim kurulamadı!'; // Daha genel hata mesajı
    } finally {
        predictButton.disabled = false;
        clearButton.disabled = false;
    }
}


// --- NETWORK ANİMASYON FONKSİYONLARI (Güncellenmiş) ---

function getRandomInt(min, max) { // Bu artık kullanılmayacak ama kalabilir
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Düğüm oluşturma fonksiyonu güncellendi
function createNode(layerType, index) {
    const node = document.createElement('div');
    node.classList.add('node');
    let nodeId = `${layerType.charAt(0)}${index}`; // i0, h1_0, h2_0, o0 gibi ID'ler
    let nodeValueText = '';
    let nodeValueNumeric = 0;

    switch (layerType) {
        case 'input':
            nodeId = `i${index}`;
            nodeValueText = ''; // GİRİŞ KATMANI BOŞ
            nodeValueNumeric = 0; // Değeri 0 kabul edelim
            break;
        case 'hidden1':
            nodeId = `h1_${index}`;
            nodeValueNumeric = Math.random(); // 0.0 ile 1.0 arası rastgele sayı
            nodeValueText = nodeValueNumeric.toFixed(2); // "0.XX" formatında göster
            break;
        case 'hidden2':
            nodeId = `h2_${index}`;
            nodeValueNumeric = Math.random(); // 0.0 ile 1.0 arası rastgele sayı
            nodeValueText = nodeValueNumeric.toFixed(2); // "0.XX" formatında göster
            break;
        case 'output':
            nodeId = `o${index}`;
            node.classList.add('output');
            nodeValueText = index; // Çıkışta sadece index (0-9) göster
            nodeValueNumeric = 0; // Sıralama için önemsiz
            break;
    }
    node.dataset.layer = layerType;
    node.dataset.id = nodeId;
    node.dataset.value = nodeValueNumeric; // SIRALAMA İÇİN SAYISAL DEĞERİ SAKLA
    node.textContent = nodeValueText; // GÖRSEL METNİ AYARLA

    return node;
}

// Sadece gizli katman değerlerini ondalıklı rastgele yapar
function randomizeHiddenNodeValues() {
    ['hidden1', 'hidden2'].forEach(layerKey => {
        allNodes[layerKey]?.forEach(node => {
            const newValueNumeric = Math.random(); // 0.0 - 1.0
            node.dataset.value = newValueNumeric; // Sayısal değeri güncelle
            node.textContent = newValueNumeric.toFixed(2); // Görseli güncelle
        });
    });
    console.log("Animasyon için gizli katman değerleri (0.00-1.00) yenilendi.");
}


function initializeNetwork() {
    // Mevcut node'ları temizle
    inputLayer.querySelectorAll('.node').forEach(n => n.remove());
    hiddenLayer1.querySelectorAll('.node').forEach(n => n.remove());
    hiddenLayer2.querySelectorAll('.node').forEach(n => n.remove());
    outputLayer.querySelectorAll('.node').forEach(n => n.remove());
    svg.innerHTML = ''; // Bağlantıları temizle
    allNodes = { input: [], hidden1: [], hidden2: [], output: [] };
    allLines = [];
    clearAnimationTimeouts();

    // Düğümleri Oluştur ve Ekle (Yeni createNode ile)
    for (let i = 0; i < config.inputNodes; i++) { const node = createNode('input', i); inputLayer.appendChild(node); allNodes.input.push(node); }
    for (let i = 0; i < config.hiddenNodes1; i++) { const node = createNode('hidden1', i); hiddenLayer1.appendChild(node); allNodes.hidden1.push(node); }
    for (let i = 0; i < config.hiddenNodes2; i++) { const node = createNode('hidden2', i); hiddenLayer2.appendChild(node); allNodes.hidden2.push(node); }
    for (let i = 0; i < config.outputNodes; i++) { const node = createNode('output', i); outputLayer.appendChild(node); allNodes.output.push(node); }
    console.log("Network yapısı oluşturuldu (Giriş boş, Gizli ondalıklı).");
}

function getNodeCenter(nodeElement) {
    const containerRect = networkContainer?.getBoundingClientRect();
    if (!nodeElement || !nodeElement.offsetParent || !containerRect) return { x: 0, y: 0 };
    const nodeRect = nodeElement.getBoundingClientRect();
    const x = nodeRect.left + nodeRect.width / 2 - containerRect.left;
    const y = nodeRect.top + nodeRect.height / 2 - containerRect.top;
    return { x, y };
}

function drawConnections() {
    if (!networkContainer || !svg) return; // Elementler yoksa çizme
    svg.innerHTML = ''; // Öncekileri temizle
    allLines = [];

    const drawLayerConnections = (fromLayerNodes, toLayerNodes) => {
        if (!fromLayerNodes || !toLayerNodes) return;
        fromLayerNodes.forEach(fromNode => {
            const start = getNodeCenter(fromNode);
            toLayerNodes.forEach(toNode => {
                const end = getNodeCenter(toNode);
                // Başlangıç veya bitiş koordinatları alınamadıysa veya sıfırsa çizme
                 if (isNaN(start.x) || isNaN(start.y) || isNaN(end.x) || isNaN(end.y) ||
                    (start.x === 0 && start.y === 0 && fromNode.offsetParent === null) || // Düğüm DOM'da değilse
                    (end.x === 0 && end.y === 0 && toNode.offsetParent === null) ) {
                       // console.warn(`Geçersiz koordinat, çizgi atlandı: ${fromNode?.dataset?.id} -> ${toNode?.dataset?.id}`);
                       return;
                }

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
        if (svg.parentNode){ // SVG hala DOM'daysa çizim yap
             drawLayerConnections(allNodes.input, allNodes.hidden1);
             drawLayerConnections(allNodes.hidden1, allNodes.hidden2);
             drawLayerConnections(allNodes.hidden2, allNodes.output);
             console.log(`Toplam ${allLines.length} bağlantı çizildi/güncellendi.`);
        } else {
            console.warn("SVG DOM'da bulunamadı, bağlantılar çizilemedi.");
        }

    });
}

function clearAnimationTimeouts() {
    animationTimeoutIds.forEach(clearTimeout);
    animationTimeoutIds = [];
}

function clearHighlights() {
    clearAnimationTimeouts();
    // Hem animasyonlu hem de statik vurguları kaldır
    document.querySelectorAll('.node.highlight, .node.winner').forEach(node => node.classList.remove('highlight', 'winner'));
    document.querySelectorAll('line.animated-highlight, line.highlight').forEach(line => {
        line.classList.remove('animated-highlight', 'highlight');
        // Animasyon stillerini temizle
        line.style.strokeDasharray = '';
        line.style.strokeDashoffset = '';
        line.style.animation = ''; // Animasyonu tamamen kaldır
    });
}

function animateLine(lineElement, delay) {
    if (!lineElement) return;

    // Animasyonu başlatmak için timeout ayarla
    const timeoutId = setTimeout(() => {
        if (!lineElement) return; // Timeout çalıştığında line hala var mı?
        // Animasyon sınıfını ekle (CSS'deki @keyframes tetiklenecek)
        lineElement.classList.add('animated-highlight'); // CSS'deki kesik çizgi animasyonunu kullanır

        // Animasyon bittikten sonra statik vurguya geçme (isteğe bağlı, şimdilik kapalı)
        /*
        const animationDuration = 500; // CSS animation-duration ile aynı olmalı
        const staticHighlightTimeoutId = setTimeout(() => {
            if (lineElement?.classList.contains('animated-highlight')) {
                lineElement.classList.remove('animated-highlight');
                lineElement.classList.add('highlight'); // Kalıcı vurgu
            }
        }, animationDuration);
        animationTimeoutIds.push(staticHighlightTimeoutId);
        */
    }, delay);
    animationTimeoutIds.push(timeoutId);
}

// Değere göre (ondalıklı) en iyi N aday arasından rastgele birini seçer
function selectNodeBasedOnValue(availableNodes, excludeIds = new Set(), topN = 3) {
    const candidates = availableNodes.filter(node => node && !excludeIds.has(node.dataset.id)); // Null/undefined kontrolü
    if (candidates.length === 0) {
        const fallback = availableNodes.find(node => node && !excludeIds.has(node.dataset.id)) || availableNodes.find(node => node);
        console.warn("Hariç tutma sonrası aday kalmadı, fallback kullanılıyor:", fallback?.dataset?.id);
        return fallback || null;
    }

    // Değere göre (dataset.value, artık ondalıklı) büyükten küçüğe sırala
    candidates.sort((a, b) => parseFloat(b.dataset.value) - parseFloat(a.dataset.value));

    // En iyi N adayı seç (veya daha az varsa hepsi)
    const numTopChoices = Math.min(candidates.length, topN);
    const topChoices = candidates.slice(0, numTopChoices);

    if (topChoices.length === 0) return candidates[0]; // Hata durumu

    // En iyi N aday arasından rastgele birini döndür
    return topChoices[Math.floor(Math.random() * topChoices.length)];
}


function generatePathsToOutput(targetOutputIndex) {
    clearHighlights();

    const targetOutputNode = allNodes.output?.[targetOutputIndex];
    if (!targetOutputNode) {
         console.error(`Animasyon için hedef çıktı düğümü bulunamadı: index ${targetOutputIndex}`);
         return;
    }

    const numPaths = getRandomInt(3, 5); // Oluşturulacak yol sayısı (3-5 arası)
    const usedInputNodeIds = new Set();
    const usedHidden1NodeIds = new Set();
    const usedHidden2NodeIds = new Set();

    console.log(`Animasyon: Hedef ${targetOutputIndex} için ${numPaths} yol oluşturuluyor...`);
    let pathDelayOffset = 0; // Farklı yolların başlangıç zamanları arası fark

    for (let i = 0; i < numPaths; i++) {
        // 1. Node Seçimi (En yüksek değerli N aday arasından rastgele)
        // Giriş katmanı düğümlerinin değeri olmadığı için rastgele seçilebilir veya hepsi kullanılabilir.
        // Şimdilik rastgele seçelim ama değere bakmayalım.
        const availableInputs = allNodes.input.filter(node => !usedInputNodeIds.has(node.dataset.id));
        const selectedInputNode = availableInputs.length > 0 ? availableInputs[Math.floor(Math.random() * availableInputs.length)] : allNodes.input[0];
        if (!selectedInputNode) continue;
        usedInputNodeIds.add(selectedInputNode.dataset.id);


        const selectedHidden1Node = selectNodeBasedOnValue(allNodes.hidden1, usedHidden1NodeIds, 3); // Top 3'ten rastgele
        if (!selectedHidden1Node) continue;
        usedHidden1NodeIds.add(selectedHidden1Node.dataset.id);

        const selectedHidden2Node = selectNodeBasedOnValue(allNodes.hidden2, usedHidden2NodeIds, 3); // Top 3'ten rastgele
        if (!selectedHidden2Node) continue;
        usedHidden2NodeIds.add(selectedHidden2Node.dataset.id);

        // 2. Bağlantı Çizgilerini Bul
        const line1 = allLines.find(l => l.dataset.from === selectedInputNode.dataset.id && l.dataset.to === selectedHidden1Node.dataset.id);
        const line2 = allLines.find(l => l.dataset.from === selectedHidden1Node.dataset.id && l.dataset.to === selectedHidden2Node.dataset.id);
        const line3 = allLines.find(l => l.dataset.from === selectedHidden2Node.dataset.id && l.dataset.to === targetOutputNode.dataset.id);

        if (!line1 || !line2 || !line3) {
            console.warn(`Yol ${i+1} için çizgiler bulunamadı, animasyon atlandı. From: ${selectedInputNode.dataset.id}, H1: ${selectedHidden1Node.dataset.id}, H2: ${selectedHidden2Node.dataset.id}, To: ${targetOutputNode.dataset.id}`);
            continue; // Bir çizgi eksikse bu yolu atla
        }

        // 3. Animasyonları Zamanla
        const segmentDelay = 400; // Her adım (çizgi) arası gecikme
        const nodeHighlightDelay = 50; // Düğümün çizgiden ne kadar sonra vurgulanacağı

        // Girdi -> H1
        const inputTimeoutId = setTimeout(() => selectedInputNode?.classList.add('highlight'), pathDelayOffset + nodeHighlightDelay);
        animationTimeoutIds.push(inputTimeoutId);
        animateLine(line1, pathDelayOffset + nodeHighlightDelay / 2); // Çizgi biraz önce başlasın

        // H1 -> H2
        const h1TimeoutId = setTimeout(() => selectedHidden1Node?.classList.add('highlight'), pathDelayOffset + segmentDelay + nodeHighlightDelay);
        animationTimeoutIds.push(h1TimeoutId);
        animateLine(line2, pathDelayOffset + segmentDelay + nodeHighlightDelay / 2);

        // H2 -> Çıkış
        const h2TimeoutId = setTimeout(() => selectedHidden2Node?.classList.add('highlight'), pathDelayOffset + segmentDelay * 2 + nodeHighlightDelay);
        animationTimeoutIds.push(h2TimeoutId);
        animateLine(line3, pathDelayOffset + segmentDelay * 2 + nodeHighlightDelay / 2);

        // Çıkış Node'u (Kazanan Vurgusu) - Özel sınıf ekle
        const outputTimeoutId = setTimeout(() => targetOutputNode?.classList.add('highlight', 'winner'), pathDelayOffset + segmentDelay * 3 + nodeHighlightDelay);
        animationTimeoutIds.push(outputTimeoutId);

        pathDelayOffset += 150; // Sonraki yol biraz daha geç başlasın (daha akıcı görünüm)
    }
    console.log("Animasyon zamanlamaları ayarlandı.");
}


// --- OLAY DİNLEYİCİLERİ VE BAŞLANGIÇ ---

// Canvas Olayları
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing); // Fare canvas dışına çıkınca çizimi durdur
// Dokunmatik olaylar için preventDefault ve passive:false önemli
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startDrawing(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); draw(e); }, { passive: false });
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing); // Dokunma iptal olursa

// Buton Olayları
clearButton.addEventListener('click', clearCanvas);
predictButton.addEventListener('click', requestPrediction);

// Sayfa Yüklendiğinde Çalışacaklar
window.addEventListener('load', () => {
    console.log("Sayfa yüklendi.");
    initializeCanvas();     // Canvas'ı hazırla
    initializeNetwork();    // Network yapısını oluştur (güncellenmiş node'larla)
    // Bağlantıları çizmek için küçük bir gecikme (DOM'un tamamen hazır olması için)
    setTimeout(() => {
         if (typeof drawConnections === 'function') {
            requestAnimationFrame(drawConnections); // İlk çizimi yap
         } else {
             console.error("drawConnections fonksiyonu yüklenmedi!");
         }
    }, 200); // Gecikme süresini ayarlayabilirsin

    // Pencere yeniden boyutlandırıldığında bağlantıları güncelle
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        clearHighlights(); // Mevcut animasyonu/vurguyu temizle
        resizeTimer = setTimeout(() => {
            if (typeof drawConnections === 'function') {
                requestAnimationFrame(drawConnections); // Bağlantıları yeniden çiz/pozisyonla
                console.log("Pencere boyutu değişti, bağlantılar güncellendi.");
            }
        }, 250); // Yeniden boyutlandırma bittikten sonra çiz
    });
});

console.log("script.js yüklendi ve çalışmaya hazır (Güncellenmiş Sürüm).");