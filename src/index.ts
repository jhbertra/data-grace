import { Maybe } from "./maybe";
import * as M from "./maybe";
import { Validator, DecodeError } from "./validator";
import * as V from "./validator";
import { objectFromEntries } from "./prelude";

type Frequency = "SemiMonthly" | "Monthly";
type Salary = { frequency: Frequency, amount: number };
type Employee = {
    firstName: string,
    middleName: Maybe<string>,
    lastName: string,
    salaries: [Date, Salary][]
}

function decodeSalary(spec: object) : Validator<DecodeError, Salary> {
    return V.liftO<DecodeError, Salary>({
        frequency: V.property(
            spec,
            "frequency",
            x => V.oneOf<Frequency>(x, "SemiMonthly", "Monthly")),
        amount: V.property(spec, "amount", V.number)
    });
}

function decodeSalaryRecord(spec: object) : Validator<DecodeError, [Date, Salary]> {
    return V.tuple<[Date, Salary]>(
        spec,
        V.date,
        x => V.object(decodeSalary, x));
}

function decodeEmployee(spec: object) : Validator<DecodeError, Employee> {
    return V.liftO<DecodeError, Employee>({
        firstName: V.property(spec, "firstName", V.string),
        middleName: V.property(spec, "middleName", x => V.optional(V.string, x)),
        lastName: V.property(spec, "lastName", V.string),
        salaries: V.property(spec, "salaries", x => V.array(decodeSalaryRecord, x))
    });
}

const result = decodeEmployee({
    firstName: 0,//"Bob",
    middleName: "Micheal",
    lastName: true,//"Hawkins",
    salaries: [["2019-07-25", {amount: 100, frequency: "Monthly"}]]
});

console.log(result.toEither().mapLeft(objectFromEntries).mapLeft(JSON.stringify).map(JSON.stringify).toString());