/* Login, configuração inicial e troca de senha. */
(function () {
  const { api } = App;
  const $ = (id) => document.getElementById(id);

  const login = $('loginForm');
  if (login) {
    try { const why = sessionStorage.getItem('agua.reason'); if (why) { $('loginError').textContent = why; sessionStorage.removeItem('agua.reason'); } } catch (_) {}
    login.addEventListener('submit', async (e) => {
      e.preventDefault();
      $('loginError').textContent = '';
      const btn = login.querySelector('button'); btn.disabled = true;
      const r = await api.post('/api/auth/login', { username: $('username').value.trim(), password: $('password').value });
      btn.disabled = false;
      if (!r.success) { $('loginError').textContent = r.error; return; }
      try { localStorage.setItem('agua.user', JSON.stringify(r.user)); } catch (_) {}
      location.href = r.redirect || '/';
    });
  }

  const setup = $('setupForm');
  if (setup) {
    setup.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = App.formData(setup);
      if (d.password !== d.confirm) { $('setupError').textContent = 'As senhas não coincidem.'; return; }
      const r = await api.post('/api/setup', { name: d.name, username: d.username, email: d.email, password: d.password });
      if (!r.success) { $('setupError').textContent = r.error; return; }
      App.toast('Administrador criado. Faça login.', 'success');
      setTimeout(() => location.href = '/login', 900);
    });
  }

  const pw = $('passwordForm');
  if (pw) {
    api.get('/api/auth/session').then(r => {
      if (r.user && r.user.must_change_password) $('pwHint').textContent = 'Primeiro acesso: substitua a senha temporária por uma senha sua.';
    });
    $('pwLogout').addEventListener('click', (e) => { e.preventDefault(); App.logout(); });
    pw.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = App.formData(pw);
      if (d.new_password !== d.confirm) { $('pwError').textContent = 'As senhas não coincidem.'; return; }
      const r = await api.post('/api/auth/password', { current_password: d.current_password, new_password: d.new_password });
      if (!r.success) { $('pwError').textContent = r.error; return; }
      App.toast('Senha alterada.', 'success');
      setTimeout(() => location.href = r.redirect || '/', 700);
    });
  }
})();
