import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dqhujeggbndwcavzgnhm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxaHVqZWdnYm5kd2NhdnpnbmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzNzM2MDcsImV4cCI6MjEwMDk0OTYwN30.ixW2V-WWQnOB8q4REtuF1KK3-bULS7fWw5NIg43EpV4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
