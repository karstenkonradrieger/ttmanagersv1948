import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chat, useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Bot, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { deleteTournamentChat, fetchTournamentChat } from '@/services/tournamentChat';

interface Props {
  tournamentId: string;
}

const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-tournament`;

export function TournamentDataChat({ tournamentId }: Props) {
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    fetchTournamentChat(tournamentId)
      .then((messages) => active && setInitialMessages(messages))
      .catch(() => active && toast.error('Der gespeicherte Frageverlauf konnte nicht geladen werden.'));
    return () => { active = false; };
  }, [tournamentId]);

  if (!initialMessages) {
    return <div className="border border-border bg-card p-4 text-sm text-muted-foreground">Frageverlauf wird geladen …</div>;
  }

  return <TournamentDataChatReady key={tournamentId} tournamentId={tournamentId} initialMessages={initialMessages} textareaRef={textareaRef} />;
}

function TournamentDataChatReady({ tournamentId, initialMessages, textareaRef }: Props & { initialMessages: UIMessage[]; textareaRef: React.RefObject<HTMLTextAreaElement> }) {
  const transport = useMemo(() => new DefaultChatTransport<UIMessage>({
    api: functionUrl,
    prepareSendMessagesRequest: async ({ messages }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Die Anmeldung ist abgelaufen. Bitte erneut anmelden.');
      return {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: { tournamentId, messages },
      };
    },
  }), [tournamentId]);
  const chat = useMemo(() => new Chat<UIMessage>({
    id: `tournament-${tournamentId}`,
    messages: initialMessages,
    transport,
    onError: (error) => toast.error(error.message || 'Die Frage konnte nicht beantwortet werden.'),
    onFinish: () => window.setTimeout(() => textareaRef.current?.focus(), 0),
  }), [initialMessages, textareaRef, tournamentId, transport]);
  const { messages, sendMessage, setMessages, status, stop } = useChat({ chat });
  useEffect(() => { textareaRef.current?.focus(); }, [textareaRef]);

  const reload = useCallback(async () => {
    if (status === 'submitted' || status === 'streaming') return;
    try {
      setMessages(await fetchTournamentChat(tournamentId));
    } catch {
      toast.error('Der Frageverlauf konnte nicht aktualisiert werden.');
    }
  }, [setMessages, status, tournamentId]);

  useEffect(() => {
    const channel = supabase.channel(`tournament-chat-${tournamentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_chat_messages', filter: `tournament_id=eq.${tournamentId}` }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload, tournamentId]);

  const handleDelete = async () => {
    try {
      await deleteTournamentChat(tournamentId);
      setMessages([]);
      toast.success('Frageverlauf gelöscht.');
      textareaRef.current?.focus();
    } catch {
      toast.error('Der Frageverlauf konnte nicht gelöscht werden.');
    }
  };

  return (
    <section className="border border-border bg-card p-3 sm:p-4" aria-labelledby="tournament-data-chat-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 id="tournament-data-chat-title" className="font-semibold">Turnierdaten fragen</h4>
          <p className="form-hint">Antworten beruhen ausschließlich auf den aktuell gespeicherten Turnierdaten.</p>
        </div>
        {messages.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="min-h-11"><Trash2 />Verlauf löschen</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Frageverlauf löschen?</AlertDialogTitle>
                <AlertDialogDescription>Alle Fragen und Antworten zu diesem Turnier werden dauerhaft gelöscht.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11">Abbrechen</AlertDialogCancel>
                <AlertDialogAction className="min-h-11 bg-destructive text-destructive-foreground" onClick={handleDelete}>Verlauf löschen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Conversation className="mb-3 h-[min(52vh,30rem)] min-h-64 rounded-md border border-border bg-background">
        <ConversationContent className="gap-4 p-3 sm:p-4">
          {messages.length === 0 ? (
            <ConversationEmptyState icon={<Bot className="size-7" />} title="Noch keine Fragen" description="Frage zum bisherigen Turnierverlauf oder zu gespeicherten Ergebnissen." />
          ) : messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, index) => part.type === 'text' ? <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse> : null)}
              </MessageContent>
            </Message>
          ))}
          {status === 'submitted' && <Message from="assistant"><MessageContent><Shimmer>Antwort wird erstellt …</Shimmer></MessageContent></Message>}
        </ConversationContent>
        <ConversationScrollButton aria-label="Zu den neuesten Nachrichten" title="Zu den neuesten Nachrichten" />
      </Conversation>

      <PromptInput
        onSubmit={async ({ text }) => {
          const question = text.trim();
          if (!question || status === 'submitted' || status === 'streaming') return;
          if (question.length > 1200) {
            toast.error('Die Frage darf höchstens 1.200 Zeichen lang sein.');
            return;
          }
          await sendMessage({ text: question });
          window.setTimeout(() => textareaRef.current?.focus(), 0);
        }}
      >
        <PromptInputTextarea ref={textareaRef} maxLength={1200} placeholder="Was war das knappste Spiel?" aria-label="Frage zu den Turnierdaten" />
        <PromptInputFooter>
          <span className="form-hint">Enter sendet · Umschalt+Enter fügt eine Zeile ein</span>
          <PromptInputSubmit className="size-11" status={status} onStop={stop} aria-label={status === 'streaming' || status === 'submitted' ? 'Antwort stoppen' : 'Frage senden'} />
        </PromptInputFooter>
      </PromptInput>
    </section>
  );
}
