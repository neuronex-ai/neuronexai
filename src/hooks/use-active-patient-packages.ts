import { useAuth } from '@/components/auth/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { PatientPackage } from '@/types';
import { useQuery } from '@tanstack/react-query';


const fetchActivePatientPackages = async (patientId: string, userId: string): Promise<PatientPackage[]> => {


  const { data, error } = await supabase
    .from('patient_packages')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Erro ao buscar pacotes ativos do paciente:', error);
    throw new Error(error.message);
  }

  const inactive=new Set(['paused','completed','cancelled','inactive','ended','replaced']);
  return (data||[]).filter(pkg=>{const legacy=typeof pkg.active==='string'?!['false','inactive','cancelled','completed'].includes(pkg.active.toLowerCase()):pkg.active!==false;return legacy&&!inactive.has(String(pkg.package_status||'active').toLowerCase())&&pkg.total_sessions>pkg.sessions_used+(pkg.sessions_reserved||0)&&(!pkg.end_date||new Date(`${pkg.end_date}T23:59:59`)>=new Date());});
};

export const useActivePatientPackages = (patientId: string) => {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<PatientPackage[], Error>({
    queryKey: ['activePatientPackages', patientId, userId],
    queryFn: () => fetchActivePatientPackages(patientId, userId!),
    enabled: !!patientId && !!userId,
  });
};
