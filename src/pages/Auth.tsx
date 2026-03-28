import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ScaleIn } from '@/components/ui/motion';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Erfolgreich angemeldet');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success('Registrierung erfolgreich! Bitte bestätige deine E-Mail-Adresse.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentifizierungsfehler');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (error) {
      toast.error('Fehler bei der Google-Anmeldung');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <ScaleIn>
      <Card className="w-full max-w-sm border-border/50 card-shadow">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2 text-4xl">🏓</div>
          <CardTitle className="text-xl font-bold font-display">
            <span className="text-gradient">TT</span> Turniermanager
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Anmelden' : 'Registrieren'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="email@beispiel.de"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Mindestens 6 Zeichen"
              />
            </div>
            <Button type="submit" className="w-full font-medium" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? 'Anmelden' : 'Registrieren'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">oder</span>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            Mit Google anmelden
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-2">
            {isLogin ? 'Noch kein Konto?' : 'Bereits registriert?'}{' '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary underline-offset-4 hover:underline font-medium"
            >
              {isLogin ? 'Registrieren' : 'Anmelden'}
            </button>
          </p>
        </CardContent>
      </Card>
      </ScaleIn>
    </div>
  );
};

export default Auth;
