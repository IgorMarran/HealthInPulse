// ─── Cadastro: só os campos do perfil ───────────────────────────────
// O POST /auth/register espalhava o corpo inteiro no Patient/Doctor
// (mass assignment): dava para se cadastrar com healthCoins: 999999.
// O authService é trocado por um falso (require.cache) para ver o que o
// controller manda gravar, sem banco.

const test   = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');

const calls = [];
const servicePath = path.join(__dirname, '../src/services/authService.js');
require.cache[servicePath] = {
  id: servicePath, filename: servicePath, loaded: true,
  exports: { register: async (args) => { calls.push(args); return { ok: true }; } },
};
const { register } = require('../src/controllers/authController');

const post = async (body) => {
  calls.length = 0;
  let status = null;
  let error = null;
  const res = { status(s) { status = s; return this; }, json() { return this; } };
  await register({ body }, res, (err) => { error = err; });
  assert.equal(error, null);
  assert.equal(status, 201);
  return calls[0];
};

test('paciente: grava só nome, CPF, nascimento, sexo e telefone', async () => {
  const sent = await post({
    email: 'a@b.dev', password: '12345678', role: 'PATIENT',
    fullName: 'Ana', cpf: '111.222.333-44', dateOfBirth: '1990-01-02', gender: 'OTHER',
    healthCoins: 999999, id: 'x', userId: 'y', crm: 'CRM-SP 1',
  });
  assert.deepEqual(sent, {
    email: 'a@b.dev', password: '12345678', role: 'PATIENT',
    profileData: { fullName: 'Ana', cpf: '111.222.333-44', dateOfBirth: new Date('1990-01-02'), gender: 'OTHER' },
  });
});

test('data de nascimento do <input type="date"> vira Date; data inválida dá 422', async () => {
  let error = null;
  await register({ body: { email: 'd@b.dev', password: '12345678', role: 'PATIENT', fullName: 'D', dateOfBirth: 'ontem' } },
    { status() { return this; }, json() { return this; } }, (err) => { error = err; });
  assert.equal(error?.status, 422);
});

test('médico: grava só nome, CRM, especialidade e telefone (o cadastro de médico continua na demo)', async () => {
  const sent = await post({
    email: 'm@b.dev', password: '12345678', role: 'DOCTOR',
    fullName: 'Dra. X', crm: 'CRM-SP 2', specialty: 'Clínica', bio: 'injetada', userId: 'y', cpf: '1',
  });
  assert.deepEqual(sent.profileData, { fullName: 'Dra. X', crm: 'CRM-SP 2', specialty: 'Clínica' });
});

test('valor que não é texto não passa (objeto no lugar do nome)', async () => {
  const sent = await post({ email: 'c@b.dev', password: '12345678', role: 'PATIENT', fullName: 'C', phone: { set: '1' } });
  assert.deepEqual(sent.profileData, { fullName: 'C' });
});
