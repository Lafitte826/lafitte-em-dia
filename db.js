// Armazenamento no próprio celular (IndexedDB): estado das tarefas, rascunhos e fotos.
// Usado pela página e pelo service worker.

const DB = (() => {
  let conexao;
  function abrir() {
    if (conexao) return conexao;
    conexao = new Promise((ok, erro) => {
      const req = indexedDB.open("zelador", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("kv");
        req.result.createObjectStore("fotos", { keyPath: "id", autoIncrement: true }).createIndex("tarefa", "tarefa");
      };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => erro(req.error);
    });
    return conexao;
  }
  async function op(loja, modo, fn) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const tx = db.transaction(loja, modo);
      const req = fn(tx.objectStore(loja));
      tx.oncomplete = () => ok(req && req.result);
      tx.onerror = () => erro(tx.error);
    });
  }
  return {
    ler: chave => op("kv", "readonly", s => s.get(chave)),
    gravar: (chave, valor) => op("kv", "readwrite", s => s.put(valor, chave)),
    fotos: tarefa => op("fotos", "readonly", s => s.index("tarefa").getAll(tarefa)),
    addFoto: foto => op("fotos", "readwrite", s => s.add(foto)),
    apagarFoto: id => op("fotos", "readwrite", s => s.delete(id)),
    limpar: () => Promise.all([op("kv", "readwrite", s => s.clear()), op("fotos", "readwrite", s => s.clear())]),
    async apagarFotos(tarefa) {
      for (const f of await DB.fotos(tarefa)) await DB.apagarFoto(f.id);
    },
  };
})();
