import { useEffect, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface ConsentDocumentDialogProps {
  url: string | null;
  name: string;
  onClose: () => void;
  onDelete: () => void | Promise<void>;
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

export function ConsentDocumentDialog({ url, name, onClose, onDelete }: ConsentDocumentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadPdfPreview = async () => {
      if (!url || isImageUrl(url)) {
        setPdfPages([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setPdfPages([]);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('download_failed');
        }

        const blob = await response.blob();
        const contentType = blob.type.toLowerCase();
        const shouldRenderAsPdf = isPdfUrl(url) || contentType.includes('pdf');

        if (!shouldRenderAsPdf) {
          throw new Error('unsupported_file');
        }

        const fileBuffer = await blob.arrayBuffer();
        const pdf = await getDocument({ data: new Uint8Array(fileBuffer) }).promise;
        const renderedPages: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.max(1.2, 1100 / baseViewport.width));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            throw new Error('canvas_unavailable');
          }

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvas, canvasContext: context, viewport }).promise;
          renderedPages.push(canvas.toDataURL('image/png'));
        }

        if (!cancelled) {
          setPdfPages(renderedPages);
        }
      } catch (previewError) {
        console.error('Error rendering consent document preview:', previewError);
        if (!cancelled) {
          setError('Das Dokument konnte nicht direkt angezeigt werden.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPdfPreview();

    return () => {
      cancelled = true;
    };
  }, [url]);

  const imagePreview = url && isImageUrl(url);
  const hasPdfPreview = !imagePreview && pdfPages.length > 0;

  return (
    <Dialog open={!!url} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Fotoerlaubnis — {name}</DialogTitle>
        </DialogHeader>

        {url && (
          <div className="space-y-4">
            {imagePreview ? (
              <div className="max-h-[70vh] overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
                <img src={url} alt={`Fotoerlaubnis von ${name}`} className="w-full h-auto rounded" />
              </div>
            ) : loading ? (
              <div className="flex h-[70vh] flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <p>Dokument wird geladen…</p>
              </div>
            ) : hasPdfPreview ? (
              <div className="max-h-[70vh] space-y-4 overflow-y-auto rounded-md border border-border bg-muted/20 p-3">
                {pdfPages.map((pageSrc, index) => (
                  <img
                    key={`${pageSrc}-${index}`}
                    src={pageSrc}
                    alt={`Fotoerlaubnis ${name}, Seite ${index + 1}`}
                    className="w-full rounded border border-border bg-background shadow-sm"
                    loading="lazy"
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <p>{error ?? 'Das Dokument konnte nicht angezeigt werden.'}</p>
                <a href={url} download className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                  <Download className="h-4 w-4" />
                  Dokument herunterladen
                </a>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <a href={url} download className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <Download className="h-4 w-4" />
                Herunterladen
              </a>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-1">
                    <Trash2 className="h-3.5 w-3.5" /> Dokument löschen
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Fotoerlaubnis löschen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Das hinterlegte Dokument von <strong>{name}</strong> wird unwiderruflich gelöscht. Der Fotoerlaubnis-Status wird zurückgesetzt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => { void onDelete(); }}
                    >
                      Löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
