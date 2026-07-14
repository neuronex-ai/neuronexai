import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, User, Building, FileText, MapPin, Phone, Camera, CheckCircle2, AlertCircle } from "lucide-react";
import { useProfile } from "@/hooks/use-profile";
import { useUploadAvatar } from "@/hooks/use-upload-avatar";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCRP, getRegionFromCRP, isValidCRPFormat } from "@/lib/crp";
import { cn } from "@/lib/utils";

const ProfileSchema = z.object({
  first_name: z.string().min(2, "Nome obrigatório"),
  last_name: z.string().min(2, "Sobrenome obrigatório"),
  clinic_name: z.string().optional(),
  crp: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof ProfileSchema>;

export const ProfessionalProfileForm = () => {
  const { data: profile, isLoading, updateProfile, isUpdating } = useProfile();
  const { mutate: uploadAvatar, isPending: isUploadingAvatar } = useUploadAvatar();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crpState, setCrpState] = useState<string | null>(null);
  const [crpValid, setCrpValid] = useState<boolean | null>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      clinic_name: "",
      crp: "",
      address: "",
      phone: "",
      bio: "",
    },
  });

  const crpValue = form.watch("crp");

  // Real-time CRP validation
  useEffect(() => {
    if (crpValue && crpValue.length >= 8) {
      const isValid = isValidCRPFormat(crpValue);
      setCrpValid(isValid);
      if (isValid) {
        setCrpState(getRegionFromCRP(crpValue));
      } else {
        setCrpState(null);
      }
    } else {
      setCrpValid(null);
      setCrpState(null);
    }
  }, [crpValue]);

  useEffect(() => {
    if (profile) {
      form.reset({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        clinic_name: profile.clinic_name || "",
        crp: profile.crp || "",
        address: profile.address || "",
        phone: profile.phone || "",
        bio: profile.bio || "",
      });
      if (profile.avatar_url) {
        setPreviewUrl(profile.avatar_url);
      }
    }
  }, [profile, form]);

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile(values);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      uploadAvatar(file);
    }
  };

  const handleCRPChange = (value: string, onChange: (value: string) => void) => {
    const formatted = formatCRP(value);
    onChange(formatted);
  };

  if (isLoading) {
    return <div className="space-y-6">
      <div className="flex gap-4"><Skeleton className="h-16 w-16 rounded-full bg-secondary/20" /><div className="space-y-2"><Skeleton className="h-6 w-40 bg-secondary/20" /><Skeleton className="h-4 w-60 bg-secondary/10" /></div></div>
      <div className="grid grid-cols-2 gap-6"><Skeleton className="h-12 bg-secondary/20" /><Skeleton className="h-12 bg-secondary/20" /></div>
    </div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-6 border-b border-zinc-200/60 dark:border-white/5 pb-8 text-center md:flex-row md:items-start md:text-left md:justify-between">
        <div className="flex flex-col items-center gap-6 md:flex-row">
          <div className="relative group cursor-pointer">
            <label htmlFor="avatar-upload" className="cursor-pointer">
              <Avatar className="h-24 w-24 border-4 border-background ring-2 ring-border/10 shadow-2xl transition-transform group-hover:scale-105">
                <AvatarImage src={previewUrl || ""} className="object-cover" />
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary">
                  <User className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>

              <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                {isUploadingAvatar ? <Loader2 className="h-6 w-6 text-white animate-spin" /> : <Camera className="h-6 w-6 text-white" />}
              </div>
              <input
                id="avatar-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={isUploadingAvatar}
              />
            </label>
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground">Identidade Profissional</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto md:mx-0">
              Estas informações serão exibidas no Portal do Paciente e em documentos gerados.
            </p>
          </div>
        </div>
        {/* Button removed from header */}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-4xl">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu nome" {...field} className="bg-white/50 dark:bg-white/[0.03] border-zinc-200/60 dark:border-white/10 focus:border-primary/40 h-12 rounded-xl text-foreground placeholder:text-muted-foreground/40 transition-all shadow-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">Sobrenome</FormLabel>
                  <FormControl>
                    <Input placeholder="Seu sobrenome" {...field} className="bg-white/50 dark:bg-white/[0.03] border-zinc-200/60 dark:border-white/10 focus:border-primary/40 h-12 rounded-xl text-foreground placeholder:text-muted-foreground/40 transition-all shadow-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="clinic_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold"><Building className="h-3 w-3" /> Consultório</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Clínica Mente Sã" {...field} className="bg-white/50 dark:bg-white/[0.03] border-zinc-200/60 dark:border-white/10 focus:border-primary/40 h-12 rounded-xl text-foreground placeholder:text-muted-foreground/40 transition-all shadow-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="crp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold"><FileText className="h-3 w-3" /> CRP</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Ex: 06/12345"
                        value={field.value}
                        onChange={(e) => handleCRPChange(e.target.value, field.onChange)}
                        className={cn(
                          "bg-white/50 dark:bg-white/[0.03] border-border/10 focus:border-primary/40 h-12 rounded-xl text-foreground placeholder:text-muted-foreground/40 transition-all shadow-sm pr-10",
                          crpValid === true && "border-emerald-500/50 focus:border-emerald-500",
                          crpValid === false && "border-red-500/50 focus:border-red-500"
                        )}
                      />
                      {/* Validation Icon */}
                      {crpValid !== null && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {crpValid ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  {/* CRP State Feedback */}
                  {crpState && crpValid && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Formato de CRP válido • {crpState}
                    </p>
                  )}
                  {crpValid === false && crpValue && crpValue.length >= 8 && (
                    <p className="text-[10px] text-red-500 font-medium">
                      Formato inválido. Use: 00/00000
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold"><Phone className="h-3 w-3" /> Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(00) 00000-0000" {...field} className="bg-white/50 dark:bg-white/[0.03] border-zinc-200/60 dark:border-white/10 focus:border-primary/40 h-12 rounded-xl text-foreground placeholder:text-muted-foreground/40 transition-all shadow-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold"><MapPin className="h-3 w-3" /> Endereço</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, Número, Bairro - Cidade/UF" {...field} className="bg-white/50 dark:bg-white/[0.03] border-zinc-200/60 dark:border-white/10 focus:border-primary/40 h-12 rounded-xl text-foreground placeholder:text-muted-foreground/40 transition-all shadow-sm" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-bold">Mini Bio</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Uma breve descrição sobre sua abordagem e especialidades..."
                    {...field}
                    rows={4}
                    className="bg-white/50 dark:bg-white/[0.03] border-border/10 focus:border-primary/40 resize-none rounded-xl custom-scrollbar text-foreground placeholder:text-muted-foreground/40 transition-all shadow-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-center md:justify-end pt-4">
            <Button
              type="submit"
              disabled={isUpdating}
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-10 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 active:shadow-none hover:-translate-y-0.5 w-full md:w-auto"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};
