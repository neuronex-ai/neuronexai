import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/SessionContextProvider';

export interface PatientPackageWithPatient {
    id: string;
    patient_id: string;
    user_id: string;
    total_sessions: number;
    sessions_used: number;
    sessions_reserved?: number;
    price: number;
    start_date: string;
    end_date: string;
    status: string;
    created_at: string;
    description: string;
    patient: {
        name: string;
    };
}

const fetchAllPatientPackages = async (userId: string): Promise<PatientPackageWithPatient[]> => {
    const { data, error } = await supabase
        .from('patient_packages')
        .select(`
      *,
      patient: patients(name)
    `)
        .eq('user_id', userId)
        .order('start_date', { ascending: false });

    if (error) {
        console.error('Erro ao buscar todos os pacotes:', error);
        throw new Error(error.message);
    }

    // Transform constraints from supabase (array/single object issue)
    return (data || []).map((pkg: any) => ({
        ...pkg,
        patient: pkg.patient || { name: 'Paciente Desconhecido' }
    })) as PatientPackageWithPatient[];
};

export const useAllPackages = () => {
    const { user } = useAuth();
    const userId = user?.id;

    return useQuery<PatientPackageWithPatient[], Error>({
        queryKey: ['allPatientPackages', userId],
        queryFn: () => fetchAllPatientPackages(userId!),
        enabled: !!userId,
    });
};
