import eel
import tensorflow as tf
import numpy as np
from PIL import Image
import base64
import io
import re
import os
import sys # PyInstaller için

# --- Ayarlar ---
WEB_FOLDER = 'web' # HTML/CSS/JS dosyalarının olduğu klasör
MODEL_FILENAME = 'mnist_digit_recognizer_model.keras' # Model dosyasının adı
IMG_WIDTH = 28
IMG_HEIGHT = 28

# --- PyInstaller için dosya yolu ayarlama ---
def resource_path(relative_path):
    """ Kaynağa mutlak yolu alır, geliştirme ve PyInstaller için çalışır """
    try:
        # PyInstaller geçici bir klasör oluşturur ve yolu _MEIPASS'ta saklar
        base_path = sys._MEIPASS
    except Exception:
        # Geliştirme ortamı
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# Model dosyasının yolunu belirle
MODEL_LOAD_PATH = resource_path(MODEL_FILENAME)
print(f"Model dosyası aranıyor: {MODEL_LOAD_PATH}")

# --- Model Yükleme ---
loaded_model = None
if not os.path.exists(MODEL_LOAD_PATH):
    print(f"!!!!!!!! HATA !!!!!!!!")
    print(f"Model dosyası bulunamadı: '{MODEL_LOAD_PATH}'")
    print(f"Lütfen '{MODEL_FILENAME}' dosyasının main.py ile aynı klasörde olduğundan emin olun.")
    input("Kapatmak için Enter'a basın...")
    exit() # Model yoksa devam etmenin anlamı yok
else:
    print(f"'{MODEL_LOAD_PATH}' yükleniyor...")
    try:
        loaded_model = tf.keras.models.load_model(MODEL_LOAD_PATH)
        print("===> Model başarıyla yüklendi. <===")
        # loaded_model.summary() # İstersen model özetini açabilirsin
    except Exception as e:
        print(f"!!!!!!!! HATA !!!!!!!!")
        print(f"Model yüklenirken hata oluştu: {e}")
        print("TensorFlow veya Keras kurulumunda sorun olabilir veya model dosyası bozuk olabilir.")
        input("Kapatmak için Enter'a basın...")
        exit()

# --- Görüntü İşleme Fonksiyonu ---
def preprocess_image(base64_string):
    """Canvas'tan gelen Base64 PNG verisini işler."""
    try:
        # Başlığı kaldır
        base64_data = re.sub('^data:image/.+;base64,', '', base64_string)
        img_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(img_bytes))

        # Alfa kanalını kaldır ve beyaz arka planla birleştir
        if img.mode == 'RGBA':
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background

        # Gri Tonlama
        img_gray = img.convert('L')

        # Yeniden Boyutlandır (Kaliteli küçültme önemli)
        img_resized = img_gray.resize((IMG_WIDTH, IMG_HEIGHT), Image.Resampling.LANCZOS)

        # NumPy Array
        img_array = np.array(img_resized)

        # Renkleri Ters Çevir (ÇOK ÖNEMLİ: Canvas beyaz arka plan, MNIST siyah bekler)
        img_inverted = 255 - img_array
        print(" > Görüntü renkleri ters çevrildi (Model için).")

        # Normalizasyon [0, 1]
        img_normalized = img_inverted / 255.0

        # Modelin Beklediği Şekle Getir (1, 28, 28, 1)
        model_input = img_normalized.reshape(1, IMG_HEIGHT, IMG_WIDTH, 1)

        # Ön yüzde göstermek için normalize edilmiş resmi Base64'e çevir
        processed_pil_img = Image.fromarray((img_normalized * 255).astype(np.uint8))
        buffer = io.BytesIO()
        processed_pil_img.save(buffer, format="PNG")
        processed_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
        processed_data_url = f"data:image/png;base64,{processed_base64}"

        return model_input, processed_data_url

    except Exception as e:
        print(f"!! Görüntü işlenirken hata: {e}")
        return None, None


# --- JavaScript Tarafından Çağrılacak Fonksiyon ---
@eel.expose  # Bu fonksiyonu JavaScript'ten çağırılabilir yap
def predict_digit(image_b64):
    """Base64 resmi alır, tahmin yapar ve sonucu JS'e döndürür."""
    print("\nPython: 'predict_digit' fonksiyonu çağrıldı.")

    if loaded_model is None:
        print("!! HATA: Model yüklenemediği için tahmin yapılamıyor.")
        return {'error': 'Model yüklenemedi.'}

    # Resmi işle
    model_input, processed_data_url = preprocess_image(image_b64)

    if model_input is None:
        return {'error': 'Görüntü işlenemedi.'}

    # Tahmin yap
    try:
        print(" > Model ile tahmin yapılıyor...")
        predictions = loaded_model.predict(model_input)
        predicted_label = int(np.argmax(predictions[0]))
        confidence = float(np.max(predictions[0]) * 100)

        print(f"===> Tahmin Sonucu: {predicted_label}, Güven: {confidence:.2f}% <===")

        # Sonucu sözlük olarak döndür
        return {
            'prediction': predicted_label,
            'confidence': confidence,
            'normalized_image': processed_data_url # İşlenmiş resmi de gönder
        }
    except Exception as e:
        print(f"!! Tahmin sırasında hata oluştu: {e}")
        return {'error': f'Tahmin hatası: {e}'}

# --- Eel Başlatma ---
web_folder_path = resource_path(WEB_FOLDER) # PyInstaller için web klasörünün yolunu al
print(f"Web dosyaları sunuluyor: {web_folder_path}")

try:
    eel.init(web_folder_path) # Web dosyalarının olduğu klasörü belirt
    print("Eel arayüzü başlatılıyor...")
    # Ayarları doğrudan eel.start'a anahtar kelime argümanı olarak verin:
    eel.start('index.html',
              mode='chrome',     # 'chrome', 'edge' veya None (otomatik seçsin)
              host='localhost',
              port=8080,         # Başka bir program kullanmıyorsa bu port uygundur
              size=(1300, 850),  # Pencere boyutu (geniş ekran için)
              block=True)        # block=True pencere kapanana kadar çalışır

except (OSError, IOError) as e:
     print(f"!!!!!!!! HATA !!!!!!!!")
     print(f"Eel başlatılamadı. Tarayıcı bulunamadı veya port ({8080}) kullanımda olabilir: {e}")
     print("Lütfen Google Chrome veya Microsoft Edge'in kurulu olduğundan emin olun.")
     print("Veya main.py dosyasındaki 'port' numarasını değiştirmeyi deneyin (örn: 8081).")
     input("Kapatmak için Enter'a basın.")
except Exception as e: # Genel hataları da yakala
    print(f"!!!!!!!! Beklenmedik Hata !!!!!!!!")
    print(f"Hata: {e}")
    input("Kapatmak için Enter'a basın.")


print("Uygulama kapatıldı.")