"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface AnalyticsData {
  membersBySangh: { name: string; prefix: string; count: number; sanghId: string }[];
  familiesBySangh: { name: string; prefix: string; count: number; sanghId: string }[];
  membersByAgeGroup: { group: string; count: number; min: number; max: number }[];
  childrenByPathshalaStatus: { name: string; count: number; status: string }[];
  childrenByPathshalaInterest: { name: string; count: number; interest: string }[];
  membersByArea: { area: string; count: number }[];
  registrationsOverTime: { date: string; families: number }[];
  childrenBySangh: { name: string; prefix: string; count: number; sanghId: string }[];
}

const COLORS = [
  "#b45309", // Warm Saffron
  "#0f766e", // Teal
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#6366f1", // Indigo
];

export default function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const router = useRouter();

  return (
    <div className="row g-4">
      {/* 1. Members by Sangh */}
      <div className="col-12 col-lg-6">
        <div className="card-clean p-3 p-md-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">1. Members by Sangh</h5>
            <small className="text-muted">Click bar to search</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                data={data.membersBySangh}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="prefix" angle={-15} textAnchor="end" interval={0} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip
                  formatter={(val: number) => [`${val} Members`, "Count"]}
                  labelFormatter={(lbl) => `Sangh: ${lbl}`}
                />
                <Bar
                  dataKey="count"
                  fill="#b45309"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) => router.push(`/search?sanghId=${entry.sanghId}`)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 2. Families by Sangh */}
      <div className="col-12 col-lg-6">
        <div className="card-clean p-3 p-md-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">2. Families by Sangh</h5>
            <small className="text-muted">Click bar to view</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                data={data.familiesBySangh}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="prefix" angle={-15} textAnchor="end" interval={0} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip
                  formatter={(val: number) => [`${val} Families`, "Count"]}
                  labelFormatter={(lbl) => `Sangh: ${lbl}`}
                />
                <Bar
                  dataKey="count"
                  fill="#0f766e"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) => router.push(`/families?sanghId=${entry.sanghId}`)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 3. Members by Age Group */}
      <div className="col-12 col-lg-6">
        <div className="card-clean p-3 p-md-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">3. Members by Age Group</h5>
            <small className="text-muted">Demographics distribution</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                data={data.membersByAgeGroup}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="group" fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip formatter={(val: number) => [`${val} Individuals`, "Members"]} />
                <Bar
                  dataKey="count"
                  fill="#d97706"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) =>
                    router.push(`/search?ageMin=${entry.min}&ageMax=${entry.max}`)
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. Children by Pathshala Status */}
      <div className="col-12 col-lg-6">
        <div className="card-clean p-3 p-md-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">4. Children by Pathshala Status</h5>
            <small className="text-muted">Age &lt; 18</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.childrenByPathshalaStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={95}
                  dataKey="count"
                  cursor="pointer"
                  onClick={(entry) =>
                    router.push(`/search?ageMax=17&pathshalaStatus=${entry.status}`)
                  }
                >
                  {data.childrenByPathshalaStatus.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [`${val} Children`, "Count"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Children by Pathshala Interest */}
      <div className="col-12 col-lg-6">
        <div className="card-clean p-3 p-md-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">5. Children by Pathshala Interest</h5>
            <small className="text-muted">Age &lt; 18</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data.childrenByPathshalaInterest}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={95}
                  dataKey="count"
                  cursor="pointer"
                  onClick={(entry) =>
                    router.push(`/search?ageMax=17&pathshalaInterest=${entry.interest}`)
                  }
                >
                  {data.childrenByPathshalaInterest.map((_, index) => (
                    <Cell key={`cell-int-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [`${val} Children`, "Interest"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 6. Members by Area */}
      <div className="col-12 col-lg-6">
        <div className="card-clean p-3 p-md-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">6. Members by Top Areas</h5>
            <small className="text-muted">Geographical distribution</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                layout="vertical"
                data={data.membersByArea}
                margin={{ top: 10, right: 20, left: 30, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis dataKey="area" type="category" width={90} fontSize={11} />
                <Tooltip formatter={(val: number) => [`${val} Members`, "Count"]} />
                <Bar
                  dataKey="count"
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(entry) => router.push(`/search?area=${encodeURIComponent(entry.area)}`)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 7. Registrations Over Time */}
      <div className="col-12 col-lg-6">
        <div className="card-clean p-3 p-md-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">7. Daily Registration Trend</h5>
            <small className="text-muted">Last 14 days</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart
                data={data.registrationsOverTime}
                margin={{ top: 10, right: 20, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} angle={-15} textAnchor="end" />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip formatter={(val: number) => [`${val} Families`, "Registrations"]} />
                <Line
                  type="monotone"
                  dataKey="families"
                  stroke="#b45309"
                  strokeWidth={3}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 8. Children by Sangh */}
      <div className="col-12 col-lg-6">
        <div className="card-clean p-3 p-md-4 h-100">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="fw-bold text-dark mb-0">8. Children (&lt;18) by Sangh</h5>
            <small className="text-muted">Pathshala student base</small>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart
                data={data.childrenBySangh}
                margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="prefix" angle={-15} textAnchor="end" interval={0} fontSize={12} />
                <YAxis allowDecimals={false} fontSize={12} />
                <Tooltip
                  formatter={(val: number) => [`${val} Children`, "Count"]}
                  labelFormatter={(lbl) => `Sangh: ${lbl}`}
                />
                <Bar
                  dataKey="count"
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(entry) =>
                    router.push(`/search?sanghId=${entry.sanghId}&ageMax=17`)
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
