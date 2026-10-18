import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  ClipboardPaste,
  FileText,
  Repeat,
  Zap,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { TransferDialog } from "./TransferDialog";
import { ReceiveDialog } from "./ReceiveDialog";

export function QuickActions() {
  const [key, setKey] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  return (
    <div className="panel flex flex-col p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary">
          <Zap className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Ações rápidas</h2>
          <p className="text-xs text-muted-foreground">
            Pesquisar, receber e enviar
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              setKey(await navigator.clipboard.readText());
            } catch {
              /* ignore clipboard error */
            }
          }}
          className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-primary hover:opacity-80"
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Colar
        </button>
      </div>

      <form
        className="mt-4 space-y-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          setTransferOpen(true);
        }}
      >
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Cole uma chave PIX, carteira cripto ou CLABE"
          className="w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="w-full cursor-pointer rounded-lg bg-primary py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Continuar
        </button>
      </form>

      <div className="mt-4 space-y-1">
        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium transition-colors hover:bg-surface-2"
        >
          <ArrowUpRight className="h-4 w-4 text-primary" strokeWidth={1.75} />
          <span className="flex-1">Enviar pagamento</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </button>

        <button
          type="button"
          onClick={() => setReceiveOpen(true)}
          className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium transition-colors hover:bg-surface-2"
        >
          <ArrowDownLeft className="h-4 w-4 text-primary" strokeWidth={1.75} />
          <span className="flex-1">Receber pagamento</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </button>

        <Link
          to="/$section"
          params={{ section: "converter" }}
          className="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          <Repeat className="h-4 w-4 text-primary" strokeWidth={1.75} />
          <span className="flex-1">Converter</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>

        <Link
          to="/$section"
          params={{ section: "extrato" }}
          className="group flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2"
        >
          <FileText className="h-4 w-4 text-primary" strokeWidth={1.75} />
          <span className="flex-1">Extrato</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </Link>
      </div>

      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        initialPixKey={key}
      />
      <ReceiveDialog open={receiveOpen} onOpenChange={setReceiveOpen} />
    </div>
  );
}
