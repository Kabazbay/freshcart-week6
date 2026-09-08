app.get("/api/products", (req, res) => {
  throw new Error("Intentional crash");
});
