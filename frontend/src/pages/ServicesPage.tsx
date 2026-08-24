import { useEffect, useState } from "react";

// Shape returned by GET /api/services — mirrors the Prisma query in
// backend/src/routes/services.ts (service fields + nested resource + business name).
type Service = {
  id: string;
  name: string;
  durationMins: number;
  price: string; // Prisma Decimal serializes to a string over JSON
  resource: {
    name: string;
    business: {
      name: string;
    };
  };
};

// Proves the Phase 2 schema/migration/seed data all work by rendering real data
// from the database, instead of just a health-check ping.
export default function ServicesPage() {
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setServices)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>Services</h1>

      {error && <p style={{ color: "crimson" }}>Failed to load services: {error}</p>}

      {!error && !services && <p>Loading services…</p>}

      {services && services.length === 0 && <p>No services found — did you run "npm run seed"?</p>}

      {services && services.length > 0 && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Service</th>
              <th>Duration</th>
              <th>Price</th>
              <th>Provider</th>
              <th>Business</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{service.name}</td>
                <td>{service.durationMins} min</td>
                <td>${service.price}</td>
                <td>{service.resource.name}</td>
                <td>{service.resource.business.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
