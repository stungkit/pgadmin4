SELECT t.oid, t.tgname as name, t.tgenabled AS is_enable_trigger, des.description
FROM pg_catalog.pg_trigger t
    LEFT OUTER JOIN pg_catalog.pg_description des ON (des.objoid=t.oid AND des.classoid='pg_trigger'::regclass)
WHERE NOT tgisinternal
    AND tgrelid = {{tid}}::OID
{% if trid %}
    AND t.oid = {{trid}}::OID
{% endif %}
{% if schema_diff %}
    AND CASE WHEN (SELECT COUNT(*) FROM pg_catalog.pg_depend
        WHERE objid = t.oid AND deptype = 'e') > 0 THEN FALSE ELSE TRUE END
{% endif %}
    ORDER BY tgname;
