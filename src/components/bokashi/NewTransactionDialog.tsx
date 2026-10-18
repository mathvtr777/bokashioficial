import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { createTransaction } from "@/services/transactions";
import type { TxStatus } from "@/data/mock";
import { useAuth } from "@/contexts/AuthContext";

export function NewTransactionDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"Entrada" | "Saída">("Entrada");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<TxStatus>("Concluído");

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (tx: { name: string; type: "Entrada" | "Saída"; value: number; status?: TxStatus }) =>
      createTransaction(tx, user?.id),
    onSuccess: (newTx) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial_stats"] });
      queryClient.invalidateQueries({ queryKey: ["currencies"] });
      toast.success("Transação registrada com sucesso!", {
        description: `${newTx.name} - R$ ${Math.abs(newTx.value).toFixed(2)} (${newTx.status})`,
      });
      setOpen(false);
      setName("");
      setValue("");
    },
    onError: (err) => {
      toast.error("Erro ao registrar transação", {
        description: err instanceof Error ? err.message : "Ocorreu um erro inesperado",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value.replace(",", "."));
    if (!name.trim()) {
      toast.error("Informe a descrição da transação");
      return;
    }
    if (isNaN(num) || num <= 0) {
      toast.error("Informe um valor válido maior que zero");
      return;
    }

    mutation.mutate({
      name: name.trim(),
      type,
      value: num,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
          <Plus className="h-4 w-4" /> Nova Transação
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
          <p className="text-xs text-muted-foreground">
            Cadastre uma nova movimentação financeira no banco de dados.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Descrição</label>
            <input
              type="text"
              placeholder="Ex: Recebimento PIX, Venda curso..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "Entrada" | "Saída")}
                className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="Entrada">Entrada (+)</option>
                <option value="Saída">Saída (-)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TxStatus)}
              className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="Concluído">Concluído</option>
              <option value="Pendente">Pendente</option>
              <option value="Em análise">Em análise</option>
            </select>
          </div>

          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-input bg-surface px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-2"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending ? "Salvando..." : "Salvar no Banco"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
