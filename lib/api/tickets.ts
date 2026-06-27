import "server-only";
import { createTableApi, type ApiRecord } from "./_crud";

export type TicketRecord = ApiRecord;
export type TicketDivisionRecord = ApiRecord;
export type TicketPersonRecord = ApiRecord;
export type TicketTypeRecord = ApiRecord;

const tickets = createTableApi<TicketRecord>("tickets", {
  orderBy: "created_at",
  ascending: false,
});

const divisions = createTableApi<TicketDivisionRecord>("tkt_divisi", {
  orderBy: "nama",
  ascending: true,
});

const people = createTableApi<TicketPersonRecord>("tkt_people", {
  orderBy: "nama",
  ascending: true,
});

const types = createTableApi<TicketTypeRecord>("tkt_types", {
  orderBy: "nama",
  ascending: true,
});

export const listTickets = tickets.list;
export const countTickets = tickets.count;
export const getTicket = tickets.get;
export const createTicket = tickets.create;
export const updateTicket = tickets.update;
export const deleteTicket = tickets.remove;

export const listTicketDivisions = divisions.list;
export const createTicketDivision = divisions.create;
export const updateTicketDivision = divisions.update;
export const deleteTicketDivision = divisions.remove;

export const listTicketPeople = people.list;
export const createTicketPerson = people.create;
export const updateTicketPerson = people.update;
export const deleteTicketPerson = people.remove;

export const listTicketTypes = types.list;
export const createTicketType = types.create;
export const updateTicketType = types.update;
export const deleteTicketType = types.remove;
