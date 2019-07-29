import * as C from "./codec";
import { Maybe } from "./maybe";

type Frequency = "SemiMonthly" | "Monthly";
type Salary = { frequency: Frequency, amount: number };
type Employee = {
    firstName: string,
    middleName: Maybe<string>,
    lastName: string,
    salaries: Array<[Date, Salary]>,
};

const salaryDecoder = C.liftO<Salary>({
    amount: C.property("amount", C.number),
    frequency: C.property("frequency", C.oneOf("SemiMonthly", "Monthly")),
});

const salaryRecordDecoder = C.tuple(C.date, C.object(salaryDecoder));

const employeeDecoder = C.liftO<Employee>({
    firstName: C.property("firstName", C.string),
    lastName: C.property("lastName", C.string),
    middleName: C.property("middleName", C.optional(C.string)),
    salaries: C.property("salaries", C.array(salaryRecordDecoder)),
});

const result = employeeDecoder.decode({
    firstName: "Bob",
    lastName: "Hawkins",
    middleName: "Micheal",
    salaries: [["2019-07-25", { amount: 100, frequency: "Monthly" }]],
});

// tslint:disable-next-line: no-console
console.log(result.toEither().mapLeft(JSON.stringify).map(JSON.stringify).toString());
