// Базовый JavaScript для функциональности
document.addEventListener('DOMContentLoaded', function() {
  console.log('Сайт загружен!');
  
  // Инициализация анимаций при скролле
  function initScrollAnimations() {
    const elements = document.querySelectorAll('.scroll-animate');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    elements.forEach((element, index) => {
      element.style.transitionDelay = `${index * 100}ms`;
      observer.observe(element);
    });
  }
  
  // Переключение между вкладками логина и регистрации
  function initAuthTabs() {
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginFormContainer = document.getElementById('loginFormContainer');
    const registerFormContainer = document.getElementById('registerFormContainer');
    
    if (!loginTab || !registerTab) return;
    
    loginTab.addEventListener('click', (e) => {
      e.preventDefault();
      loginTab.classList.add('text-orange-400', 'border-orange-500');
      loginTab.classList.remove('text-gray-400');
      registerTab.classList.remove('text-orange-400', 'border-orange-500');
      registerTab.classList.add('text-gray-400');
      loginFormContainer.classList.remove('hidden');
      registerFormContainer.classList.add('hidden');
    });
    
    registerTab.addEventListener('click', (e) => {
      e.preventDefault();
      registerTab.classList.add('text-orange-400', 'border-orange-500');
      registerTab.classList.remove('text-gray-400');
      loginTab.classList.remove('text-orange-400', 'border-orange-500');
      loginTab.classList.add('text-gray-400');
      registerFormContainer.classList.remove('hidden');
      loginFormContainer.classList.add('hidden');
    });
  }
  
  // Предпросмотр аватара
  function initAvatarPreview() {
    const avatarUpload = document.getElementById('avatarUpload');
    const avatarPreview = document.getElementById('avatarPreview');
    
    if (!avatarUpload || !avatarPreview) return;
    
    avatarUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function(e) {
          avatarPreview.src = e.target.result;
          avatarPreview.classList.add('avatar-loaded');
        }
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Обработка формы регистрации
  function initRegistrationForm() {
    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;
    
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const firstName = document.getElementById('firstName').value.trim();
      const lastName = document.getElementById('lastName').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Валидация
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        showNotification('Все поля обязательны для заполнения!', 'error');
        return;
      }
      
      if (password !== confirmPassword) {
        showNotification('Пароли не совпадают!', 'error');
        return;
      }
      
      if (password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов!', 'error');
        return;
      }
      
      if (!isValidEmail(email)) {
        showNotification('Введите корректный email!', 'error');
        return;
      }

      // Use Firebase to create user
      showNotification('Регистрация... Подождите', 'info');
      
      // Check protocol first
      if (window.location.protocol === 'file:') {
        showNotification('⚠️ Откройте сайт через HTTP/HTTPS (используйте Live Server), а не через file://', 'error');
        return;
      }
      
      // Wait for Firebase to be ready
      let fb;
      try {
        // Wait for Firebase module to load (with timeout)
        if (!window.firebase) {
          console.log('Waiting for Firebase to initialize...');
          if (window.firebaseReady) {
            await Promise.race([
              window.firebaseReady,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Таймаут загрузки Firebase')), 10000)
              )
            ]);
          } else {
            // Wait a bit for module to load
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        // Check if Firebase is available
        if (!window.firebase) {
          throw new Error('Firebase не загружен. Проверьте консоль браузера (F12) на ошибки загрузки модулей.');
        }
        
        // Check if Firebase has error
        if (window.firebase.isError || window.firebase.error) {
          throw new Error('Ошибка загрузки Firebase модулей. Проверьте консоль браузера.');
        }
        
        fb = window.firebase;
        
        // Verify Firebase services are initialized
        if (!fb.auth || !fb.db) {
          throw new Error('Firebase сервисы не инициализированы. Проверьте консоль браузера.');
        }
        
        if (!fb.createUserWithProfile) {
          throw new Error('Firebase API недоступен. Функция createUserWithProfile не найдена.');
        }
        
        console.log('✅ Firebase готов к использованию');
      } catch (err) {
        console.error('❌ Firebase initialization error:', err);
        let errorMsg = 'Ошибка инициализации Firebase: ' + err.message;
        if (err.message.includes('Таймаут')) {
          errorMsg += '\n\nВозможные причины:\n1. Проблемы с интернетом\n2. Блокировка CORS\n3. Откройте сайт через HTTP сервер (не file://)';
        }
        showNotification(errorMsg, 'error');
        return;
      }

      try {
        
        // Create user first (without avatar)
        console.log('Creating user account...');
        const userCred = await fb.createUserWithProfile(email, password, {
          displayName: firstName,
          firstName,
          lastName,
          photoURL: null // Will be updated after avatar upload
        });
        const user = userCred.user;
        console.log('User created successfully:', user.uid);
        
        // Upload avatar if any (now with correct UID)
        const avatarInput = document.getElementById('avatarUpload');
        let photoURL = null;
        if (avatarInput && avatarInput.files && avatarInput.files[0]) {
          try {
            console.log('Uploading avatar for user:', user.uid);
            photoURL = await fb.uploadAvatar(avatarInput.files[0], user.uid);
            console.log('Avatar uploaded successfully:', photoURL);
            
            // Update user profile with avatar URL
            if (photoURL) {
              await fb.updateProfile(user, { photoURL });
              // Update Firestore document with avatar URL
              await fb.setUserDoc(user.uid, { photoURL });
              console.log('User profile updated with avatar');
            }
          } catch (avatarError) {
            console.warn('Avatar upload failed, but user was created:', avatarError);
            // Don't fail registration if avatar upload fails
          }
        }
      } catch (err) {
        console.error('❌ Registration error:', err);
        console.error('Error details:', {
          code: err.code,
          message: err.message,
          stack: err.stack
        });
        
        // Translate common Firebase errors to Russian
        let errorMessage = 'Ошибка регистрации';
        if (err.code) {
          switch (err.code) {
            case 'auth/email-already-in-use':
              errorMessage = 'Этот email уже используется';
              break;
            case 'auth/invalid-email':
              errorMessage = 'Некорректный email адрес';
              break;
            case 'auth/operation-not-allowed':
              errorMessage = 'Регистрация по email отключена';
              break;
            case 'auth/weak-password':
              errorMessage = 'Пароль слишком слабый';
              break;
            case 'auth/network-request-failed':
              errorMessage = 'Ошибка сети. Проверьте подключение к интернету';
              break;
            case 'permission-denied':
              errorMessage = 'Нет доступа к базе данных. Проверьте правила Firestore';
              break;
            default:
              errorMessage = err.message || 'Ошибка регистрации: ' + (err.code || 'Неизвестная ошибка');
          }
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        showNotification(errorMessage, 'error');
        return;
      }

        showNotification('Регистрация успешна!', 'success');

        // Показываем приветствие
        const welcomeMessage = document.getElementById('welcomeMessage');
        const welcomeUserName = document.getElementById('welcomeUserName');
        const authButton = document.getElementById('filterDropdownButton');
        
        if (welcomeMessage && welcomeUserName) {
          welcomeUserName.textContent = firstName;
          welcomeMessage.classList.remove('hidden');
        }
        
        if (authButton) {
          authButton.textContent = 'Мой профиль';
          authButton.classList.add('bg-gradient-to-r', 'from-orange-500', 'to-orange-600');
        }

        // Скрываем dropdown
        const registerDropdown = document.getElementById('registerDropdown');
        if (registerDropdown) {
          registerDropdown.classList.add('hidden');
        }

        // Сброс формы
        registerForm.reset();
        const avatarPreview = document.getElementById('avatarPreview');
        if (avatarPreview) {
          avatarPreview.src = 'https://via.placeholder.com/150';
        }
      // Переключаем на вкладку входа
      const loginTab = document.getElementById('loginTab');
      if (loginTab) {
        loginTab.click();
      }
    });
  }
  
  // Обработка формы входа
  function initLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      
      if (!email || !password) {
        showNotification('Заполните все поля!', 'error');
        return;
      }
      
      if (!isValidEmail(email)) {
        showNotification('Введите корректный email!', 'error');
        return;
      }

      showNotification('Вход... Подождите', 'info');
      try {
        if (!window.firebase) {
          await (window.firebaseReady || Promise.reject(new Error('Firebase not loaded')));
        }
      } catch (err) {
        console.warn('Firebase initialization failed, falling back to local mock auth', err);
        // Local fallback: simulate signed-in user
        const name = email.split('@')[0] || 'Пользователь';
        const welcomeMessage = document.getElementById('welcomeMessage');
        const welcomeUserName = document.getElementById('welcomeUserName');
        const authButton = document.getElementById('filterDropdownButton');
        if (welcomeMessage && welcomeUserName) {
          welcomeUserName.textContent = name;
          welcomeMessage.classList.remove('hidden');
        }
        if (authButton) {
          authButton.textContent = 'Мой профиль';
          authButton.classList.add('bg-gradient-to-r', 'from-orange-500', 'to-orange-600');
        }
        const registerDropdown = document.getElementById('registerDropdown');
        if (registerDropdown) registerDropdown.classList.add('hidden');
        loginForm.reset();
        return;
      }

      try {
        const fb = window.firebase;
        if (!fb || !fb.signInWithEmailAndPassword) throw new Error('Firebase API unavailable');
        const userCred = await fb.signInWithEmailAndPassword(email, password);
        const user = userCred.user;

        showNotification('Вход успешен!', 'success');

        // Показываем приветствие с именем пользователя из профиля
        const welcomeMessage = document.getElementById('welcomeMessage');
        const welcomeUserName = document.getElementById('welcomeUserName');
        const authButton = document.getElementById('filterDropdownButton');
        
        if (welcomeMessage && welcomeUserName) {
          welcomeUserName.textContent = (user.displayName || 'Пользователь');
          welcomeMessage.classList.remove('hidden');
        }
        
        if (authButton) {
          authButton.textContent = 'Мой профиль';
          authButton.classList.add('bg-gradient-to-r', 'from-orange-500', 'to-orange-600');
        }

        // Скрываем dropdown
        const registerDropdown = document.getElementById('registerDropdown');
        if (registerDropdown) {
          registerDropdown.classList.add('hidden');
        }

        // Сброс формы
        loginForm.reset();
      } catch (err) {
        console.error(err);
        showNotification(err.message || 'Ошибка входа', 'error');
      }
    });
  }
  
  // Управление dropdown меню
  function initDropdown() {
    const authButton = document.getElementById('filterDropdownButton');
    const registerDropdown = document.getElementById('registerDropdown');
    
    if (!authButton || !registerDropdown) return;
    
    authButton.addEventListener('click', function(e) {
      e.stopPropagation();
      registerDropdown.classList.toggle('hidden');
    });
    
    // Закрытие dropdown при клике вне его
    document.addEventListener('click', function(e) {
      if (!registerDropdown.contains(e.target) && !authButton.contains(e.target)) {
        registerDropdown.classList.add('hidden');
      }
    });
    
    // Предотвращение закрытия при клике внутри dropdown
    registerDropdown.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }
  
  // Карусель изображений
  function initSlideshow() {
    const carousel = document.getElementById('carousel');
    const carouselTrack = carousel?.querySelector('.carousel-track');
    const prevButton = document.getElementById('carouselPrev');
    const nextButton = document.getElementById('carouselNext');
    const indicatorsContainer = document.getElementById('carouselIndicators');
    
    if (!carousel || !carouselTrack || !indicatorsContainer) return;
    
    // Используем локальные изображения из папки img
    const images = [
      './img/img1.jpg',
      './img/img2.jpg',
      './img/img3.jpg'
    ];
    
    let currentSlide = 0;
    let autoSlideInterval = null;
    
    // Создаем элементы изображений
    images.forEach((imageSrc, index) => {
      // Создаем слайд
      const slide = document.createElement('div');
      slide.className = 'carousel-slide min-w-full h-full flex-shrink-0';
      slide.innerHTML = `
        <img src="${imageSrc}" alt="Изображение ${index + 1}" 
             class="w-full h-full object-cover">
      `;
      carouselTrack.appendChild(slide);
      
      // Создаем индикатор
      const indicator = document.createElement('button');
      indicator.className = `carousel-indicator w-3 h-3 rounded-full transition-all duration-300 ${
        index === 0 ? 'bg-white' : 'bg-white/50'
      }`;
      indicator.setAttribute('data-slide', index);
      indicator.setAttribute('aria-label', `Перейти к слайду ${index + 1}`);
      indicatorsContainer.appendChild(indicator);
    });
    
    // Обновление позиции карусели
    function updateCarousel() {
      carouselTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
      
      // Обновляем индикаторы
      const indicators = indicatorsContainer.querySelectorAll('.carousel-indicator');
      indicators.forEach((indicator, index) => {
        if (index === currentSlide) {
          indicator.classList.remove('bg-white/50');
          indicator.classList.add('bg-white');
        } else {
          indicator.classList.remove('bg-white');
          indicator.classList.add('bg-white/50');
        }
      });
    }
    
    // Переход к следующему слайду
    function nextSlide() {
      currentSlide = (currentSlide + 1) % images.length;
      updateCarousel();
      resetAutoSlide();
    }
    
    // Переход к предыдущему слайду
    function prevSlide() {
      currentSlide = (currentSlide - 1 + images.length) % images.length;
      updateCarousel();
      resetAutoSlide();
    }
    
    // Переход к конкретному слайду
    function goToSlide(index) {
      currentSlide = index;
      updateCarousel();
      resetAutoSlide();
    }
    
    // Автоматическая смена слайдов
    function startAutoSlide() {
      autoSlideInterval = setInterval(nextSlide, 5000);
    }
    
    function resetAutoSlide() {
      if (autoSlideInterval) {
        clearInterval(autoSlideInterval);
      }
      startAutoSlide();
    }
    
    // Обработчики событий
    if (nextButton) {
      nextButton.addEventListener('click', () => {
        nextButton.style.opacity = '1';
        nextSlide();
      });
    }
    
    if (prevButton) {
      prevButton.addEventListener('click', () => {
        prevButton.style.opacity = '1';
        prevSlide();
      });
    }
    
    // Показываем кнопки при наведении
    if (carousel) {
      carousel.addEventListener('mouseenter', () => {
        if (prevButton) prevButton.style.opacity = '1';
        if (nextButton) nextButton.style.opacity = '1';
      });
      carousel.addEventListener('mouseleave', () => {
        if (prevButton) prevButton.style.opacity = '0.7';
        if (nextButton) nextButton.style.opacity = '0.7';
      });
    }
    
    // Поддержка свайпов (для мобильных устройств)
    let touchStartX = 0;
    let touchEndX = 0;
    
    carouselTrack.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    });
    
    carouselTrack.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    });
    
    function handleSwipe() {
      if (touchEndX < touchStartX - 50) {
        nextSlide();
      }
      if (touchEndX > touchStartX + 50) {
        prevSlide();
      }
    }
    
    // Обработчики для индикаторов (после их создания)
    indicatorsContainer.querySelectorAll('.carousel-indicator').forEach((indicator, index) => {
      indicator.addEventListener('click', () => goToSlide(index));
    });
    
    // Запускаем автоматическую смену слайдов
    startAutoSlide();
    
    // Инициализация
    updateCarousel();
  }
  
  // Уведомления
  function showNotification(message, type = 'info') {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-4 rounded-xl shadow-2xl z-50 transform translate-x-full transition-transform duration-300 ${
      type === 'error' ? 'bg-red-600' : 
      type === 'success' ? 'bg-green-600' : 
      'bg-orange-600'
    }`;
    
    notification.innerHTML = `
      <div class="flex items-center">
        <span class="mr-3">${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'}</span>
        <span class="font-medium">${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Показываем уведомление
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Убираем через 4 секунды
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 4000);
  }
  
  // Валидация email
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Поиск
  function initSearch() {
    const searchInput = document.getElementById('simple-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        const query = this.value.trim();
        if (query) {
          showNotification(`Ищем: "${query}"`, 'info');
          // Здесь можно добавить логику поиска
        }
      }
    });
  }
  
  // Ripple effect for buttons
  function initButtonRipples() {
    const targets = document.querySelectorAll('.btn, .btn-glow, .rippleable');
    targets.forEach(el => {
      el.addEventListener('pointerdown', function(e) {
        const rect = el.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        const x = e.clientX - rect.left - size/2;
        const y = e.clientY - rect.top - size/2;
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        el.appendChild(ripple);
        setTimeout(() => { ripple.remove(); }, 650);
      });
    });
  }

  // Handle auth state when Firebase is available
  function initAuthState() {
    // If firebase is not present yet, try to wait for firebaseReady
    (async function() {
      try {
        if (!window.firebase) {
          await (window.firebaseReady || Promise.reject(new Error('Firebase not loaded')));
        }
        const fb = window.firebase;
        if (!fb || !fb.onAuthStateChanged) return;

        fb.onAuthStateChanged((user) => {
          const welcomeMessage = document.getElementById('welcomeMessage');
          const welcomeUserName = document.getElementById('welcomeUserName');
          const authButton = document.getElementById('filterDropdownButton');

          if (user) {
            if (welcomeMessage && welcomeUserName) {
              welcomeUserName.textContent = user.displayName || 'Пользователь';
              welcomeMessage.classList.remove('hidden');
            }
            if (authButton) {
              authButton.textContent = 'Мой профиль';
              authButton.classList.add('bg-gradient-to-r', 'from-orange-500', 'to-orange-600');
            }
          } else {
            if (welcomeMessage) welcomeMessage.classList.add('hidden');
            if (authButton) authButton.textContent = 'Войти/Регистрация';
          }
        });
      } catch (err) {
        // firebase not available; ignore silently
        console.warn('Auth state not initialized:', err.message);
      }
    })();
  }

  // Инициализация всех функций
  function initAll() {
    initScrollAnimations();
    initAuthTabs();
    initAvatarPreview();
    initRegistrationForm();
    initLoginForm();
    initDropdown();
    initSlideshow();
    initSearch();
    initButtonRipples();
    initAuthState();

    console.log('Все функции инициализированы');
  }
  
  // Запуск инициализации
  initAll();
})