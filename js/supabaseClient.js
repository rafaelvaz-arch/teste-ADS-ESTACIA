// js/supabaseClient.js

const SUPABASE_URL = 'https://mktgawqrfggmfnqcwvsm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SiOuuGYOJ08WYyczoUTvUA_6yasNb3Z';

// Usar 'var' evita erros de sintaxe caso o script recarregue
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);