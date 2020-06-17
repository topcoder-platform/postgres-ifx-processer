CREATE schema IF NOT EXISTS audit_report AUTHORIZATION postgres;

SET search_path TO audit_report;

CREATE TABLE audit_report.ifxpg_generalreport(
	rg_id int4 NOT NULL,
	"schema" varchar(20) NOT NULL,
	report_datetime timestamp NOT NULL,
	table_count_diff int4 NULL,
	pg_table_count int4 NULL,
	ifx_table_count int4 NULL,
	table_name varchar(50) NOT NULL,
	CONSTRAINT ifxpg_genaralreport_pk PRIMARY KEY (rg_id, schema, table_name)
);

CREATE TABLE audit_report.ifxpg_tblmodreport(
	rg_id int4 NOT NULL,
	"schema" varchar(20) NOT NULL,
	table_name varchar(50) NOT NULL,
	table_count int4 NOT NULL,
	modification_from date NOT NULL,
	"database" varchar(20) NOT NULL,
	report_datetime timestamp NOT NULL,
	CONSTRAINT ​ifxpg_tblmodreport_pk PRIMARY KEY (rg_id, schema, table_name, database)
);

CREATE TABLE audit_report.ifxpg_exceptionreport(
	rg_id int4 NOT NULL,
	"schema" varchar(20) NOT NULL,
	exception_table_count int4 NOT NULL,
	report_datetime timestamp NOT NULL,
	CONSTRAINT ifxpg_exceptionreport_pk PRIMARY KEY (rg_id, schema)
);

CREATE TABLE audit_report.ifxpg_tblexceptionreport(
	rg_id int4 NOT NULL,
	"schema" varchar(20) NOT NULL,
	exception_table_name varchar(50) NOT NULL,
	report_datetime timestamp NOT NULL,
	CONSTRAINT ifxpg_tblexceptionreport_pk PRIMARY KEY (rg_id, schema, exception_table_name)
);

CREATE SEQUENCE audit_report.report_generation_sequence
	INCREMENT BY 1
	MINVALUE 1
	START 1
	NO CYCLE;
