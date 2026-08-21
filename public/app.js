// KIDS9 APLICATIVO CLIENTE - LOGICA DO FRONTEND SPA

// Estado Global da Aplicação
let activeCheckins = [];
let historyCheckins = [];
let selectedCheckinForCheckout = null;
let currentAdminPin = null;

// Configuração Padrão do Limite de Ocupação
const CAPACITY_LIMIT = 20;

// ==========================================================================
// TOAST NOTIFICATIONS SYSTEM (Premium UI/UX feedback)
// ==========================================================================
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    min-width: 280px;
    max-width: 380px;
    padding: 16px 20px;
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow-md);
    border-left: 5px solid var(--primary);
    font-size: 0.85rem;
    font-weight: 500;
    pointer-events: auto;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;

  // Define emoji and color according to type
  if (type === 'success') {
    toast.style.borderLeftColor = 'var(--ok)';
    toast.innerHTML = `<span>🟢 &nbsp; ${message}</span>`;
  } else if (type === 'error') {
    toast.style.borderLeftColor = 'var(--crit)';
    toast.innerHTML = `<span>🔴 &nbsp; ${message}</span>`;
  } else if (type === 'warn') {
    toast.style.borderLeftColor = 'var(--warn)';
    toast.innerHTML = `<span>🟡 &nbsp; ${message}</span>`;
  } else {
    toast.style.borderLeftColor = 'var(--primary)';
    toast.innerHTML = `<span>ℹ️ &nbsp; ${message}</span>`;
  }

  // Close Button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: var(--ink-faint);
    font-size: 1.2rem;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  `;
  closeBtn.addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  });
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  // Auto-remove after 4 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Make showToast accessible in window for inline html events
window.showToast = showToast;

// Inicialização Geral
document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.getAttribute('data-page');

  if (page === 'operator') {
    initOperatorFlow();
    syncData();
    setInterval(syncData, 10000);
  } else if (page === 'tv') {
    syncData();
    setInterval(syncData, 10000);
  } else if (page === 'admin') {
    initAdminDashboard();
  }

  updatePhoneTime();
  setInterval(updatePhoneTime, 1000);
  setInterval(updateLiveCountdowns, 1000);
});

// ==========================================================================
// 1. RELÓGIOS E SINCRONIZAÇÃO EM SEGUNDO PLANO
// ==========================================================================

function updatePhoneTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const phoneTimeEl = document.getElementById('phone-time');
  if (phoneTimeEl) phoneTimeEl.textContent = timeStr;
  
  // FIXED: Changed tv-clock-time to tv-clock-display to match tv.html markup
  const tvTimeEl = document.getElementById('tv-clock-display');
  if (tvTimeEl) tvTimeEl.textContent = timeStr;
}

async function syncData() {
  try {
    // 1. Buscar check-ins ativos
    const response = await fetch('/api/checkins/active');
    if (response.ok) {
      const result = await response.json();
      activeCheckins = result.data || [];
      renderActiveCheckins();
      renderTVGrid();
    }

    // 2. Se a aba de admin estiver ativa, atualizar KPIs e Histórico
    const adminLayoutWrapper = document.getElementById('admin-layout-wrapper');
    if (adminLayoutWrapper && adminLayoutWrapper.style.display !== 'none') {
      await updateAdminData();
    }
  } catch (error) {
    console.error('[SYNC ERROR] Falha ao sincronizar dados com o servidor:', error);
  }
}

// Atualização de tempos restantes de forma reativa a cada 1 segundo
function updateLiveCountdowns() {
  const timeElements = document.querySelectorAll('[data-remaining-target]');
  timeElements.forEach(el => {
    try {
      const expectedTimeStr = el.getAttribute('data-remaining-target');
      if (!expectedTimeStr) return;
      
      const expectedTime = new Date(expectedTimeStr);
      if (isNaN(expectedTime.getTime())) return;

      const now = new Date();
      const diffSeconds = Math.floor((expectedTime - now) / 1000);
      
      if (diffSeconds <= 0) {
        el.textContent = 'Tempo Esgotado';
        const pill = el.nextElementSibling;
        if (pill && pill.classList && pill.classList.contains('pill')) {
          pill.className = 'pill pill-crit';
          pill.textContent = 'acabando';
        }
        el.style.color = 'var(--crit)';
      } else {
        const minutes = Math.floor(diffSeconds / 60);
        const seconds = diffSeconds % 60;
        el.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const pill = el.nextElementSibling;
        if (pill && pill.classList && pill.classList.contains('pill')) {
          if (minutes <= 5) {
            pill.className = 'pill pill-crit';
            pill.textContent = 'acabando';
            el.style.color = 'var(--crit)';
          } else if (minutes <= 10) {
            pill.className = 'pill pill-warn';
            pill.textContent = 'atenção';
            el.style.color = 'var(--warn)';
          } else {
            pill.className = 'pill pill-ok';
            pill.textContent = 'no prazo';
            el.style.color = 'var(--ink)';
          }
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar timer:', err);
    }
  });
}

// ==========================================================================
// 3. FLUXO DO OPERADOR / TELEFONE
// ==========================================================================

function initOperatorFlow() {
  // Session persistence check
  if (sessionStorage.getItem('kids9_operator_logged') === 'true') {
    switchOperatorScreen('op-screen-active');
    syncData();
  }

  // Operator Logout
  const logoutBtn = document.getElementById('operator-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('kids9_operator_logged');
      switchOperatorScreen('op-screen-login');
      document.getElementById('login-pin').value = '';
      showToast('Sessão encerrada.', 'info');
    });
  }

  // Login Form
  const loginForm = document.getElementById('login-form');
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = document.getElementById('login-pin').value;
    
    if (pin === '1234') {
      sessionStorage.setItem('kids9_operator_logged', 'true');
      switchOperatorScreen('op-screen-active');
      syncData();
      showToast('Bem-vindo, operador!', 'success');
    } else {
      showToast('PIN inválido! Utilize o PIN padrão "1234".', 'error');
    }
  });

  // Botões de Voltar genéricos
  const backButtons = document.querySelectorAll('.back-btn');
  backButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      switchOperatorScreen(target);
    });
  });

  // Abrir Formulário de Novo Check-in
  const openCheckinBtn = document.getElementById('open-checkin-btn');
  openCheckinBtn.addEventListener('click', () => {
    switchOperatorScreen('op-screen-checkin');
  });

  // Mapeamento de cliques em Chips de Atração
  const attractionChips = document.querySelectorAll('#attraction-chips .chip');
  attractionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      attractionChips.forEach(c => c.classList.remove('sel'));
      chip.classList.add('sel');
    });
  });

  // Mapeamento de cliques em Chips de Tempo
  const timeChips = document.querySelectorAll('#time-chips .chip');
  const paymentValueInput = document.getElementById('checkin-payment-value');
  timeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      timeChips.forEach(c => c.classList.remove('sel'));
      chip.classList.add('sel');
      // Atualizar valor correspondente de forma sugerida
      const price = chip.getAttribute('data-price');
      if (paymentValueInput) {
        paymentValueInput.value = price;
      }
    });
  });

  // Máscara de Telefone em Tempo Real
  const parentPhoneInput = document.getElementById('checkin-parent-phone');
  if (parentPhoneInput) {
    parentPhoneInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 11) val = val.slice(0, 11);
      
      let formatted = val;
      if (val.length > 2) {
        formatted = `(${val.slice(0,2)}) `;
        if (val.length > 7) {
          formatted += `${val.slice(2, 7)}-${val.slice(7)}`;
        } else {
          formatted += val.slice(2);
        }
      }
      e.target.value = formatted;
    });
  }

  // Formulário de Check-in (Submit)
  const checkinForm = document.getElementById('checkin-form');
  checkinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const childName = document.getElementById('checkin-child-name').value;
    const parentPhone = document.getElementById('checkin-parent-phone').value;
    
    const selectedAttractionChip = document.querySelector('#attraction-chips .chip.sel');
    const attraction = selectedAttractionChip ? selectedAttractionChip.getAttribute('data-value') : 'Piscina de bolinhas';
    
    const selectedTimeChip = document.querySelector('#time-chips .chip.sel');
    const playtimeMinutes = selectedTimeChip ? parseInt(selectedTimeChip.getAttribute('data-value'), 10) : 30;
    
    const paymentMethod = document.getElementById('checkin-payment-method').value;
    const paymentValue = parseFloat(document.getElementById('checkin-payment-value').value);

    const submitBtn = checkinForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registrando...';

    try {
      const response = await fetch('/api/checkins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childName,
          parentPhone,
          paymentMethod,
          paymentValue,
          playtimeMinutes,
          shopping: 'Kids9 Park Iguatemi L2'
        })
      });

      if (response.ok) {
        showToast('Check-in efetuado! PIN enviado via WhatsApp.', 'success');
        checkinForm.reset();
        
        // Resetar chips
        attractionChips.forEach(c => c.classList.remove('sel'));
        attractionChips[0].classList.add('sel');
        timeChips.forEach(c => c.classList.remove('sel'));
        timeChips[0].classList.add('sel');
        document.getElementById('checkin-payment-value').value = "30.00";
        
        switchOperatorScreen('op-screen-active');
        syncData();
      } else {
        const err = await response.json();
        showToast('Erro no check-in: ' + (err.error || 'Tente novamente.'), 'error');
      }
    } catch (err) {
      showToast('Falha na conexão com o servidor.', 'error');
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  // Filtro de Pesquisa de Ativos
  const searchInput = document.getElementById('search-active-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderActiveCheckins();
    });
  }

  // Ações de Checkout Normal (Pai)
  const confirmCheckoutBtn = document.getElementById('confirm-checkout-btn');
  if (confirmCheckoutBtn) {
    confirmCheckoutBtn.addEventListener('click', async () => {
      if (!selectedCheckinForCheckout) return;

      const pin = document.getElementById('checkout-pin-input').value;
      if (!pin) {
        showToast('Informe o código PIN de segurança do responsável.', 'warn');
        return;
      }

      const originalText = confirmCheckoutBtn.textContent;
      confirmCheckoutBtn.disabled = true;
      confirmCheckoutBtn.textContent = 'Processando...';

      try {
        const response = await fetch(`/api/checkins/${selectedCheckinForCheckout.id}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pin, isAdminOverride: false })
        });

        if (response.ok) {
          showToast('Saída confirmada! Criança liberada.', 'success');
          selectedCheckinForCheckout = null;
          document.getElementById('checkout-pin-input').value = '';
          switchOperatorScreen('op-screen-active');
          syncData();
        } else {
          const err = await response.json();
          showToast('Falha na saída: ' + (err.error || 'PIN inválido.'), 'error');
        }
      } catch (err) {
        showToast('Falha na comunicação com o servidor.', 'error');
        console.error(err);
      } finally {
        confirmCheckoutBtn.disabled = false;
        confirmCheckoutBtn.textContent = originalText;
      }
    });
  }

  // Modal de Admin Bypass (Liberação Administrativa)
  const adminBypassBtn = document.getElementById('admin-bypass-btn');
  const adminModal = document.getElementById('admin-modal');
  const cancelAdminModal = document.getElementById('cancel-admin-modal');
  const confirmAdminBypass = document.getElementById('confirm-admin-bypass');
  
  if (adminBypassBtn) {
    adminBypassBtn.addEventListener('click', () => {
      if (adminModal) adminModal.classList.add('active');
    });
  }
  
  if (cancelAdminModal) {
    cancelAdminModal.addEventListener('click', () => {
      if (adminModal) adminModal.classList.remove('active');
      const pinInput = document.getElementById('admin-bypass-pin-input');
      if (pinInput) pinInput.value = '';
    });
  }
  
  if (confirmAdminBypass) {
    confirmAdminBypass.addEventListener('click', async () => {
      const pinInput = document.getElementById('admin-bypass-pin-input');
      const adminPin = pinInput ? pinInput.value : '';
      if (adminPin !== '4321') {
        showToast('PIN de Administrador incorreto!', 'error');
        return;
      }

      const originalText = confirmAdminBypass.textContent;
      confirmAdminBypass.disabled = true;
      confirmAdminBypass.textContent = 'Liberando...';
      
      try {
        const response = await fetch(`/api/checkins/${selectedCheckinForCheckout.id}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isAdminOverride: true, adminPin: adminPin })
        });
        
        if (response.ok) {
          showToast('Desbloqueio efetuado! Criança liberada.', 'success');
          selectedCheckinForCheckout = null;
          const checkoutPinInput = document.getElementById('checkout-pin-input');
          if (checkoutPinInput) checkoutPinInput.value = '';
          if (adminModal) adminModal.classList.remove('active');
          if (pinInput) pinInput.value = '';
          switchOperatorScreen('op-screen-active');
          syncData();
        } else {
          const err = await response.json();
          showToast('Erro na liberação: ' + (err.error || 'Tente novamente.'), 'error');
        }
      } catch (err) {
        showToast('Falha na comunicação com o servidor.', 'error');
      } finally {
        confirmAdminBypass.disabled = false;
        confirmAdminBypass.textContent = originalText;
      }
    });
  }

  // FIXED: Wrapped extendBtn reference check to prevent console crashes when element is not present
  const extendBtn = document.getElementById('extend-time-btn');
  if (extendBtn) {
    extendBtn.addEventListener('click', () => {
      showToast('Extensão de 15 minutos adicionada na simulação.', 'info');
    });
  }
}

function switchOperatorScreen(screenId) {
  const screens = document.querySelectorAll('.screen-content');
  screens.forEach(s => s.classList.remove('active'));
  
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

// Renderização Dinâmica de Crianças Ativas no Telefone
function renderActiveCheckins() {
  const listEl = document.getElementById('op-active-list');
  if (!listEl) return;

  const filterText = document.getElementById('search-active-input').value.toLowerCase().trim();
  const filtered = activeCheckins.filter(c => c.child_name.toLowerCase().includes(filterText));

  // Atualizar contador de ativos
  const count = activeCheckins.length;
  document.getElementById('active-ratio').textContent = `${count} / ${CAPACITY_LIMIT}`;
  const pct = Math.min((count / CAPACITY_LIMIT) * 100, 100);
  document.getElementById('active-progress-bar').style.width = `${pct}%`;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${filterText ? 'Nenhum resultado para a busca.' : 'Nenhuma criança ativa no momento.'}</div>`;
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach(c => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.addEventListener('click', () => {
      openCheckoutScreen(c);
    });

    const expectedTime = new Date(c.expected_checkout_time);
    const now = new Date();
    const diffMin = Math.floor((expectedTime - now) / 60000);
    
    let pillClass = 'pill-ok';
    let pillText = 'no prazo';
    
    if (diffMin <= 5) {
      pillClass = 'pill-crit';
      pillText = 'acabando';
    } else if (diffMin <= 10) {
      pillClass = 'pill-warn';
      pillText = 'atenção';
    }

    row.innerHTML = `
      <div class="avatar">🧒</div>
      <div class="who">
        <div class="name">${c.child_name}</div>
        <div class="attr">${c.payment_method} · ${c.playtime_minutes} min</div>
      </div>
      <div class="time-col">
        <div class="time" data-remaining-target="${c.expected_checkout_time}">--:--</div>
        <span class="pill ${pillClass}">${pillText}</span>
      </div>
    `;
    listEl.appendChild(row);
  });
}

function openCheckoutScreen(checkin) {
  selectedCheckinForCheckout = checkin;
  const receiptEl = document.getElementById('checkout-receipt');
  
  const checkinTime = new Date(checkin.checkin_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const expectedCheckout = new Date(checkin.expected_checkout_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  receiptEl.innerHTML = `
    <div class="rr"><span class="k">Criança</span><span class="v">${checkin.child_name}</span></div>
    <div class="rr"><span class="k">Atração</span><span class="v">Brinquedo Kids9</span></div>
    <hr>
    <div class="rr"><span class="k">Entrada</span><span class="v">${checkinTime}</span></div>
    <div class="rr"><span class="k">Saída prevista</span><span class="v">${expectedCheckout}</span></div>
    <hr>
    <div class="rr"><span class="k">Tempo contratado</span><span class="v">${checkin.playtime_minutes} min</span></div>
    <div class="rr"><span class="k">Valor pago</span><span class="v">R$ ${parseFloat(checkin.payment_value).toFixed(2)}</span></div>
  `;

  switchOperatorScreen('op-screen-checkout');
}

// ==========================================================================
// 4. PAINEL DA TV PÚBLICA
// ==========================================================================

function renderTVGrid() {
  // FIXED: Changed tv-active-grid to tv-grid-container to match tv.html markup
  const gridEl = document.getElementById('tv-grid-container');
  if (!gridEl) return;

  // TV Vencimento Alert Bar Controller (UX requirement)
  const footerAlert = document.getElementById('tv-footer-alert');
  const alertName = document.getElementById('tv-alert-name');
  
  if (footerAlert && alertName) {
    const endingSoonKids = activeCheckins.filter(c => {
      const expectedTime = new Date(c.expected_checkout_time);
      const now = new Date();
      const diffMin = Math.floor((expectedTime - now) / 60000);
      return diffMin <= 5;
    });

    if (endingSoonKids.length > 0) {
      alertName.textContent = endingSoonKids.map(c => c.child_name).join(', ');
      footerAlert.style.display = 'block';
    } else {
      footerAlert.style.display = 'none';
    }
  }

  if (activeCheckins.length === 0) {
    gridEl.innerHTML = `<div class="empty-state" style="color:#9ca3af; border-color:rgba(255,255,255,0.08);">Nenhuma criança ativa no momento. Aproveite as vagas livres!</div>`;
    return;
  }

  gridEl.innerHTML = '';
  activeCheckins.forEach(c => {
    const expectedTime = new Date(c.expected_checkout_time);
    const now = new Date();
    const diffMin = Math.floor((expectedTime - now) / 60000);
    
    let cardClass = '';
    if (diffMin <= 5) {
      cardClass = 'crit';
    } else if (diffMin <= 10) {
      cardClass = 'warn';
    }

    // Ocultar os dígitos do meio do celular do responsável por privacidade (LGPD)
    const formattedPhone = formatPhoneMasked(c.parent_phone);

    const card = document.createElement('div');
    card.className = `tv-card ${cardClass}`;
    card.innerHTML = `
      <div class="kid-info">
        <h3>${c.child_name}</h3>
        <p>Responsável: ${formattedPhone}</p>
      </div>
      <div class="time-info">
        <div class="tv-time" data-remaining-target="${c.expected_checkout_time}">--:--</div>
      </div>
    `;
    gridEl.appendChild(card);
  });
}

function formatPhoneMasked(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const ddd = digits.slice(-11, -9);
    const firstDigit = digits.slice(-9, -8);
    const lastDigits = digits.slice(-4);
    return `(${ddd}) ${firstDigit} ****-${lastDigits}`;
  }
  return '****-' + digits.slice(-4);
}

// ==========================================================================
// 5. PAINEL ADMINISTRATIVO (DESKTOP)
// ==========================================================================

function initAdminDashboard() {
  // Session persistence check
  const savedPin = sessionStorage.getItem('kids9_admin_pin');
  if (savedPin === '4321') {
    currentAdminPin = savedPin;
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-layout-wrapper').style.display = 'flex';
    updateAdminData();
    setInterval(updateAdminData, 10000);
  }

  // Admin Logout
  const logoutLink = document.querySelector('.admin-sidebar a.sidebar-item[href="index.html"]');
  if (logoutLink) {
    logoutLink.addEventListener('click', () => {
      sessionStorage.removeItem('kids9_admin_pin');
    });
  }

  // Config Form Persistence
  const configForm = document.getElementById('config-form');
  if (configForm) {
    const alertMinutesInput = configForm.querySelector('input[type="number"]');
    if (alertMinutesInput) {
      if (localStorage.getItem('kids9_alert_minutes')) {
        alertMinutesInput.value = localStorage.getItem('kids9_alert_minutes');
      }
      const saveBtn = configForm.querySelector('.btn-primary');
      if (saveBtn) {
        saveBtn.removeAttribute('onclick');
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          localStorage.setItem('kids9_alert_minutes', alertMinutesInput.value);
          showToast('Configurações salvas localmente!', 'success');
        });
      }
    }
  }

  // Login do Admin
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pin = document.getElementById('admin-pin-input').value;
      if (pin === '4321') {
        currentAdminPin = pin;
        sessionStorage.setItem('kids9_admin_pin', pin);
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-layout-wrapper').style.display = 'flex';
        updateAdminData();
        setInterval(updateAdminData, 10000);
        showToast('Painel Administrativo liberado.', 'success');
      } else {
        showToast('PIN de Administrador incorreto!', 'error');
      }
    });
  }

  // Configuração de abas internas do Admin
  const sidebarItems = document.querySelectorAll('.admin-sidebar .sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const targetPageId = item.getAttribute('data-page');
      const pages = document.querySelectorAll('.admin-page');
      pages.forEach(p => p.classList.remove('active'));

      const targetPage = document.getElementById(targetPageId);
      if (targetPage) targetPage.classList.add('active');
    });
  });

  // Filtro de Histórico
  const historySearch = document.getElementById('history-search');
  if (historySearch) {
    historySearch.addEventListener('input', () => {
      renderAdminHistoryTable();
    });
  }
}

// Busca e renderiza os dados nas sub-páginas do Admin
async function updateAdminData() {
  if (!currentAdminPin) return;
  try {
    const headers = { 'x-admin-pin': currentAdminPin };
    // 1. Buscar estatísticas gerais
    const statsResponse = await fetch('/api/checkins/stats', { headers });
    if (statsResponse.ok) {
      const result = await statsResponse.json();
      const stats = result.data;

      // KPIs
      document.getElementById('kpi-active').textContent = stats.activeCount;
      document.getElementById('kpi-active-desc').textContent = `De ${CAPACITY_LIMIT} do plano`;
      document.getElementById('kpi-revenue').textContent = `R$ ${stats.revenueToday.toFixed(2)}`;
      document.getElementById('kpi-avg-ticket').textContent = `R$ ${stats.avgTicket.toFixed(2)}`;
      document.getElementById('kpi-total-checkins').textContent = stats.totalCount;

      // Renderizar Gráfico
      renderAdminChart(stats.hourlyData);
    }

    // 2. Buscar histórico
    const historyResponse = await fetch('/api/checkins/history', { headers });
    if (historyResponse.ok) {
      const result = await historyResponse.json();
      historyCheckins = result.data || [];
      renderAdminRecentTable();
      renderAdminHistoryTable();
    }
  } catch (error) {
    console.error('[ADMIN FETCH ERROR] Falha ao recuperar métricas:', error);
  }
}

// Renderiza a tabela de resumos no dashboard de admin
function renderAdminRecentTable() {
  const tbody = document.getElementById('admin-recent-tbody');
  if (!tbody) return;

  const recents = historyCheckins.slice(0, 5); // Últimos 5 no dashboard

  if (recents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhum check-in recente.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  recents.forEach(c => {
    const tr = document.createElement('tr');
    const checkinTime = new Date(c.checkin_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    let timeColContent = '';
    let pillClass = '';
    let pillText = '';

    if (c.status === 'completed') {
      const checkoutTime = new Date(c.actual_checkout_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      timeColContent = checkoutTime;
      pillClass = 'pill-ok';
      pillText = 'finalizado';
    } else {
      timeColContent = `<span data-remaining-target="${c.expected_checkout_time}">--:--</span>`;
      pillClass = 'pill-ok';
      pillText = 'ativo';
    }

    tr.innerHTML = `
      <td class="mono">#${c.id}</td>
      <td class="name">${c.child_name}</td>
      <td>${c.payment_method}</td>
      <td class="mono">${checkinTime}</td>
      <td class="mono">${timeColContent}</td>
      <td class="mono">R$ ${parseFloat(c.payment_value).toFixed(2)}</td>
      <td><span class="pill ${pillClass}">${pillText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Renderiza a tabela geral de histórico completo
function renderAdminHistoryTable() {
  const tbody = document.getElementById('admin-history-tbody');
  if (!tbody) return;

  const searchVal = document.getElementById('history-search').value.toLowerCase().trim();
  const filtered = historyCheckins.filter(c => 
    c.child_name.toLowerCase().includes(searchVal) || 
    c.parent_phone.includes(searchVal)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state">Nenhum registro correspondente ao filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(c => {
    const tr = document.createElement('tr');
    
    const checkinTime = new Date(c.checkin_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const checkoutTime = c.actual_checkout_time 
      ? new Date(c.actual_checkout_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
      : 'Ativo';
    
    let pillClass = c.status === 'active' ? 'pill-warn' : 'pill-ok';
    let statusText = c.status === 'active' ? 'ativo' : 'saída';

    tr.innerHTML = `
      <td class="mono">#${c.id}</td>
      <td class="name">${c.child_name}</td>
      <td>${c.parent_phone}</td>
      <td>Brinquedo Kids9</td>
      <td class="mono">${c.playtime_minutes} min</td>
      <td class="mono">${checkinTime}</td>
      <td class="mono">${checkoutTime}</td>
      <td class="mono">${c.pin}</td>
      <td class="mono">R$ ${parseFloat(c.payment_value).toFixed(2)}</td>
      <td><span class="pill ${pillClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// Renderiza as colunas de faturamento agrupadas por hora
function renderAdminChart(hourlyData) {
  const chartEl = document.getElementById('occupancy-chart');
  if (!chartEl) return;

  // Filtrar apenas o horário de funcionamento comercial comum para exibir (ex: 10h às 22h)
  const startHour = 10;
  const endHour = 22;
  const filteredHours = hourlyData.filter(d => d.hour >= startHour && d.hour <= endHour);

  // Encontrar o maior pico para calcular porcentagem de altura proporcional
  const counts = filteredHours.map(d => d.count);
  const maxCount = Math.max(...counts, 1); // evita divisão por zero

  chartEl.innerHTML = '';
  filteredHours.forEach(d => {
    const pct = (d.count / maxCount) * 100;
    
    const bar = document.createElement('div');
    bar.className = 'chart-col-wrap';

    bar.innerHTML = `
      <div class="chart-col" style="height: ${pct}%;" ${d.count === maxCount && maxCount > 0 ? 'style="background: var(--primary);"' : ''}>
        <div class="chart-col-val">${d.count}</div>
      </div>
      <div class="chart-col-label">${d.hour}h</div>
    `;
    chartEl.appendChild(bar);
  });
}
